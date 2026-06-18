"use server";

import { BusinessType, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { parseLocalizedDecimal } from "@/lib/money";
import { DEFAULT_PAYMENT_METHOD_SETTINGS } from "@/lib/payment-options";
import { prisma } from "@/lib/prisma";

export type BusinessProfileState = {
  error?: string;
  success?: string;
};

export type PaymentSettingsState = {
  error?: string;
  success?: string;
};

export async function updateBusinessProfileAction(
  _prevState: BusinessProfileState,
  formData: FormData
): Promise<BusinessProfileState> {
  const user = await requireAdminPage();

  try {
    const name = readText(formData, "name");
    if (!name) {
      throw new Error("El nombre del comercio es obligatorio.");
    }

    const businessType = String(formData.get("businessType") ?? BusinessType.KIOSK);
    if (!Object.values(BusinessType).includes(businessType as BusinessType)) {
      throw new Error("Rubro invalido.");
    }

    await prisma.businessProfile.upsert({
      where: { id: "default" },
      update: {
        name,
        businessType: businessType as BusinessType,
        cuit: readOptionalText(formData, "cuit"),
        address: readOptionalText(formData, "address"),
        phone: readOptionalText(formData, "phone"),
        currency: readText(formData, "currency") || "ARS",
        preferredTheme: readOptionalText(formData, "preferredTheme"),
        logoUrl: readOptionalText(formData, "logoUrl")
      },
      create: {
        id: "default",
        name,
        businessType: businessType as BusinessType,
        cuit: readOptionalText(formData, "cuit"),
        address: readOptionalText(formData, "address"),
        phone: readOptionalText(formData, "phone"),
        currency: readText(formData, "currency") || "ARS",
        preferredTheme: readOptionalText(formData, "preferredTheme"),
        logoUrl: readOptionalText(formData, "logoUrl")
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/ventas");

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "BusinessProfile",
      entityId: "default",
      description: "Actualizo la configuracion del comercio."
    });

    return { success: "Configuracion guardada." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar la configuracion."
    };
  }
}

export async function updatePaymentSettingsAction(
  _prevState: PaymentSettingsState,
  formData: FormData
): Promise<PaymentSettingsState> {
  const user = await requireAdminPage();

  try {
    const methodSettings = Object.values(PaymentMethod).map((method) => {
      const fallback = DEFAULT_PAYMENT_METHOD_SETTINGS.find(
        (setting) => setting.method === method
      );
      const label = readText(formData, `method-${method}-label`) || fallback?.label || method;
      const sortOrder = readPositiveInt(
        formData,
        `method-${method}-sortOrder`,
        fallback?.sortOrder ?? 0
      );

      return {
        method,
        label,
        enabled: formData.get(`method-${method}-enabled`) === "on",
        sortOrder
      };
    });

    const enabledMethods = methodSettings.filter((setting) => setting.enabled);
    if (enabledMethods.length === 0) {
      throw new Error("Debe quedar al menos un medio de pago activo.");
    }

    const planInputs = formData.getAll("planId").map((rawPlanId) => {
      const planId = String(rawPlanId);
      const installments = readPositiveInt(
        formData,
        `plan-${planId}-installments`,
        0
      );
      const surchargeRate = parseLocalizedDecimal(
        formData.get(`plan-${planId}-surchargeRate`)
      ).toDecimalPlaces(2);

      if (installments <= 0) {
        throw new Error("Las cuotas deben ser mayores a cero.");
      }
      if (surchargeRate.lt(0)) {
        throw new Error("El recargo de cuotas no puede ser negativo.");
      }

      return {
        id: planId,
        installments,
        surchargeRate,
        active: formData.get(`plan-${planId}-active`) === "on"
      };
    });

    const newInstallmentsText = readText(formData, "newInstallments");
    if (newInstallmentsText) {
      const installments = readPositiveInt(formData, "newInstallments", 0);
      const surchargeRate = parseLocalizedDecimal(
        formData.get("newSurchargeRate")
      ).toDecimalPlaces(2);

      if (installments <= 0) {
        throw new Error("Las nuevas cuotas deben ser mayores a cero.");
      }
      if (surchargeRate.lt(0)) {
        throw new Error("El nuevo recargo no puede ser negativo.");
      }

      planInputs.push({
        id: "new",
        installments,
        surchargeRate,
        active: formData.get("newActive") === "on"
      });
    }

    const duplicatedInstallments = findDuplicate(
      planInputs.map((plan) => plan.installments)
    );
    if (duplicatedInstallments !== null) {
      throw new Error(`Ya existe un plan de ${duplicatedInstallments} cuota(s).`);
    }

    await prisma.$transaction(async (tx) => {
      for (const setting of methodSettings) {
        await tx.paymentMethodSetting.upsert({
          where: { method: setting.method },
          update: {
            label: setting.label,
            enabled: setting.enabled,
            sortOrder: setting.sortOrder
          },
          create: setting
        });
      }

      for (const plan of planInputs) {
        const data = {
          installments: plan.installments,
          surchargeRate: plan.surchargeRate,
          active: plan.active
        };

        if (plan.id === "new" || plan.id.startsWith("default-")) {
          await tx.creditInstallmentPlan.upsert({
            where: { installments: plan.installments },
            update: data,
            create: data
          });
          continue;
        }

        await tx.creditInstallmentPlan.update({
          where: { id: plan.id },
          data
        });
      }

      if (methodSettings.some((setting) => setting.method === PaymentMethod.CREDIT && setting.enabled)) {
        const activeCreditPlans = await tx.creditInstallmentPlan.count({
          where: { active: true }
        });

        if (activeCreditPlans === 0) {
          throw new Error("Si credito esta activo debe existir al menos un plan de cuotas activo.");
        }
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/caja");

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "PaymentSettings",
      description: "Actualizo medios de pago y planes de cuotas.",
      metadata: {
        enabledMethods: enabledMethods.map((setting) => setting.method)
      }
    });

    return { success: "Medios de pago guardados." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar medios de pago."
    };
  }
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  return readText(formData, key) || null;
}

function readPositiveInt(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(readText(formData, key), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function findDuplicate(values: number[]) {
  const seen = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
  }
  return null;
}
