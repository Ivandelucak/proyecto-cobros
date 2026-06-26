"use server";

import { BusinessType, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { BUSINESS_PROFILE_ID } from "@/lib/business-profile";
import {
  CASH_REGISTER_SETTING_ID,
  normalizeQuickProductsLimit
} from "@/lib/cash-register-settings";
import { parseLocalizedDecimal } from "@/lib/money";
import { DEFAULT_PAYMENT_METHOD_SETTINGS } from "@/lib/payment-options";
import { prisma } from "@/lib/prisma";
import { STOCK_SETTING_ID, parseOptionalStockDecimal } from "@/lib/stock-settings";
import { TICKET_SETTING_ID } from "@/lib/ticket-settings";

const MAX_LOGO_BYTES = 1_500_000;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_PAYMENT_QR_BYTES = 2_000_000;
const ALLOWED_PAYMENT_QR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type BusinessProfileState = {
  error?: string;
  success?: string;
};

export type PaymentSettingsState = {
  error?: string;
  success?: string;
};

export type TicketSettingsState = {
  error?: string;
  success?: string;
};

export type OperationalSettingsState = {
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

    const activityStartDate = parseOptionalDate(
      formData.get("activityStartDate"),
      "Inicio de actividades"
    );
    const logoUrl = await resolveLogoUrl(formData);

    await prisma.businessProfile.upsert({
      where: { id: BUSINESS_PROFILE_ID },
      update: {
        name,
        businessType: businessType as BusinessType,
        cuit: readOptionalText(formData, "cuit"),
        address: readOptionalText(formData, "address"),
        phone: readOptionalText(formData, "phone"),
        email: readOptionalText(formData, "email"),
        fiscalCondition: readOptionalText(formData, "fiscalCondition"),
        grossIncome: readOptionalText(formData, "grossIncome"),
        activityStartDate,
        currency: readText(formData, "currency") || "ARS",
        locale: readText(formData, "locale") || "es-AR",
        timezone: readText(formData, "timezone") || "America/Argentina/Buenos_Aires",
        preferredTheme: readOptionalText(formData, "preferredTheme"),
        logoUrl,
        website: readOptionalText(formData, "website"),
        generalFooterText: readOptionalText(formData, "generalFooterText")
      },
      create: {
        id: BUSINESS_PROFILE_ID,
        name,
        businessType: businessType as BusinessType,
        cuit: readOptionalText(formData, "cuit"),
        address: readOptionalText(formData, "address"),
        phone: readOptionalText(formData, "phone"),
        email: readOptionalText(formData, "email"),
        fiscalCondition: readOptionalText(formData, "fiscalCondition"),
        grossIncome: readOptionalText(formData, "grossIncome"),
        activityStartDate,
        currency: readText(formData, "currency") || "ARS",
        locale: readText(formData, "locale") || "es-AR",
        timezone: readText(formData, "timezone") || "America/Argentina/Buenos_Aires",
        preferredTheme: readOptionalText(formData, "preferredTheme"),
        logoUrl,
        website: readOptionalText(formData, "website"),
        generalFooterText: readOptionalText(formData, "generalFooterText")
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/ventas");
    revalidatePath("/presupuestos");

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "BusinessProfile",
      entityId: BUSINESS_PROFILE_ID,
      description: "Actualizo la configuracion del comercio."
    });

    return { success: "Configuracion guardada." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar la configuracion."
    };
  }
}

export async function updateTicketSettingsAction(
  _prevState: TicketSettingsState,
  formData: FormData
): Promise<TicketSettingsState> {
  const user = await requireAdminPage();

  try {
    const ticketTitle = readText(formData, "ticketTitle") || "Ticket no fiscal";
    const nonFiscalLegend = readText(formData, "nonFiscalLegend") || "Ticket no fiscal";
    const thankYouText = readText(formData, "thankYouText") || "Gracias por su compra";

    await prisma.ticketSetting.upsert({
      where: { id: TICKET_SETTING_ID },
      update: {
        ticketTitle,
        headerText: readOptionalText(formData, "headerText"),
        footerText: readOptionalText(formData, "footerText"),
        thankYouText,
        nonFiscalLegend,
        showNonFiscalLegend: isChecked(formData, "showNonFiscalLegend"),
        showBusinessName: isChecked(formData, "showBusinessName"),
        showCuit: isChecked(formData, "showCuit"),
        showAddress: isChecked(formData, "showAddress"),
        showPhone: isChecked(formData, "showPhone"),
        showEmail: isChecked(formData, "showEmail"),
        showSeller: isChecked(formData, "showSeller"),
        showCustomer: isChecked(formData, "showCustomer"),
        showPaymentDetails: isChecked(formData, "showPaymentDetails"),
        showStockUnit: isChecked(formData, "showStockUnit"),
        showBarcode: isChecked(formData, "showBarcode")
      },
      create: {
        id: TICKET_SETTING_ID,
        ticketTitle,
        headerText: readOptionalText(formData, "headerText"),
        footerText: readOptionalText(formData, "footerText"),
        thankYouText,
        nonFiscalLegend,
        showNonFiscalLegend: isChecked(formData, "showNonFiscalLegend"),
        showBusinessName: isChecked(formData, "showBusinessName"),
        showCuit: isChecked(formData, "showCuit"),
        showAddress: isChecked(formData, "showAddress"),
        showPhone: isChecked(formData, "showPhone"),
        showEmail: isChecked(formData, "showEmail"),
        showSeller: isChecked(formData, "showSeller"),
        showCustomer: isChecked(formData, "showCustomer"),
        showPaymentDetails: isChecked(formData, "showPaymentDetails"),
        showStockUnit: isChecked(formData, "showStockUnit"),
        showBarcode: isChecked(formData, "showBarcode")
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/ventas");

    await createAuditLog({
      userId: user.id,
      action: "TICKET_SETTINGS_UPDATED",
      entity: "TicketSetting",
      entityId: TICKET_SETTING_ID,
      description: "Actualizo la configuracion de ticket."
    });

    return { success: "Configuracion de ticket guardada." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuracion de ticket."
    };
  }
}

export async function updateOperationalSettingsAction(
  _prevState: OperationalSettingsState,
  formData: FormData
): Promise<OperationalSettingsState> {
  const user = await requireAdminPage();

  try {
    const quickProductsLimit = normalizeQuickProductsLimit(
      readPositiveInt(formData, "quickProductsLimit", 12)
    );
    const defaultMinStock = parseOptionalStockDecimal(formData.get("defaultMinStock"));

    await prisma.$transaction(async (tx) => {
      await tx.cashRegisterSetting.upsert({
        where: { id: CASH_REGISTER_SETTING_ID },
        update: {
          requireOpenSession: isChecked(formData, "requireOpenSession"),
          showExpectedCashToCashier: isChecked(formData, "showExpectedCashToCashier"),
          allowCashierCancelSale: isChecked(formData, "allowCashierCancelSale"),
          allowNegativeStock: isChecked(formData, "allowNegativeStock"),
          defaultSearchMode: readOptionalText(formData, "defaultSearchMode"),
          quickProductsLimit
        },
        create: {
          id: CASH_REGISTER_SETTING_ID,
          requireOpenSession: isChecked(formData, "requireOpenSession"),
          showExpectedCashToCashier: isChecked(formData, "showExpectedCashToCashier"),
          allowCashierCancelSale: isChecked(formData, "allowCashierCancelSale"),
          allowNegativeStock: isChecked(formData, "allowNegativeStock"),
          defaultSearchMode: readOptionalText(formData, "defaultSearchMode"),
          quickProductsLimit
        }
      });

      await tx.stockSetting.upsert({
        where: { id: STOCK_SETTING_ID },
        update: {
          lowStockEnabled: isChecked(formData, "lowStockEnabled"),
          defaultMinStock,
          allowManualStockAdjustment: isChecked(formData, "allowManualStockAdjustment"),
          showLowStockWarnings: isChecked(formData, "showLowStockWarnings")
        },
        create: {
          id: STOCK_SETTING_ID,
          lowStockEnabled: isChecked(formData, "lowStockEnabled"),
          defaultMinStock,
          allowManualStockAdjustment: isChecked(formData, "allowManualStockAdjustment"),
          showLowStockWarnings: isChecked(formData, "showLowStockWarnings")
        }
      });
    });

    revalidatePath("/configuracion");
    revalidatePath("/caja");
    revalidatePath("/stock");

    await createAuditLog({
      userId: user.id,
      action: "OPERATIONAL_SETTINGS_UPDATED",
      entity: "SystemSettings",
      description: "Actualizo configuracion de caja y stock.",
      metadata: { quickProductsLimit }
    });

    return { success: "Configuracion operativa guardada." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuracion operativa."
    };
  }
}

export async function updatePaymentSettingsAction(
  _prevState: PaymentSettingsState,
  formData: FormData
): Promise<PaymentSettingsState> {
  const user = await requireAdminPage();

  try {
    const methodSettings = await Promise.all(
      Object.values(PaymentMethod).map(async (method) => {
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
          sortOrder,
          instructions: readOptionalText(formData, `method-${method}-instructions`),
          alias: readOptionalText(formData, `method-${method}-alias`),
          cbu: readOptionalText(formData, `method-${method}-cbu`),
          cvu: readOptionalText(formData, `method-${method}-cvu`),
          accountHolder: readOptionalText(formData, `method-${method}-accountHolder`),
          accountCuit: readOptionalText(formData, `method-${method}-accountCuit`),
          bankName: readOptionalText(formData, `method-${method}-bankName`),
          qrImageDataUrl: await resolvePaymentQrImageDataUrl(formData, method),
          askReference: formData.get(`method-${method}-askReference`) === "on",
          defaultProviderStatus: readOptionalText(
            formData,
            `method-${method}-defaultProviderStatus`
          ),
          surchargeRate: parseOptionalDecimal(
            formData.get(`method-${method}-surchargeRate`),
            "El recargo porcentual"
          ),
          fixedSurcharge: parseOptionalDecimal(
            formData.get(`method-${method}-fixedSurcharge`),
            "El recargo fijo"
          )
        };
      })
    );

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
            sortOrder: setting.sortOrder,
            instructions: setting.instructions,
            alias: setting.alias,
            cbu: setting.cbu,
            cvu: setting.cvu,
            accountHolder: setting.accountHolder,
            accountCuit: setting.accountCuit,
            bankName: setting.bankName,
            qrImageDataUrl: setting.qrImageDataUrl,
            askReference: setting.askReference,
            defaultProviderStatus: setting.defaultProviderStatus,
            surchargeRate: setting.surchargeRate,
            fixedSurcharge: setting.fixedSurcharge
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

      if (
        methodSettings.some(
          (setting) => setting.method === PaymentMethod.CREDIT && setting.enabled
        )
      ) {
        const activeCreditPlans = await tx.creditInstallmentPlan.count({
          where: { active: true }
        });

        if (activeCreditPlans === 0) {
          throw new Error("Si credito esta activo debe existir al menos un plan de cuotas activo.");
        }
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/configuracion/pagos");
    revalidatePath("/caja");
    revalidatePath("/ventas");
    revalidatePath("/reportes");

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

async function resolveLogoUrl(formData: FormData) {
  if (isChecked(formData, "removeLogo")) {
    return null;
  }

  const file = formData.get("logoFile");
  if (!file || typeof file === "string" || file.size === 0) {
    return normalizeExistingLogo(readOptionalText(formData, "logoUrl"));
  }

  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error("El logo debe ser PNG, JPG o WebP.");
  }

  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("El logo no puede superar 1.5 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function normalizeExistingLogo(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.length > MAX_LOGO_BYTES * 2) {
    throw new Error("El logo guardado supera el tamano permitido.");
  }

  return value;
}

async function resolvePaymentQrImageDataUrl(formData: FormData, method: PaymentMethod) {
  if (isChecked(formData, `method-${method}-removeQr`)) {
    return null;
  }

  const file = formData.get(`method-${method}-qrFile`);
  if (!file || typeof file === "string" || file.size === 0) {
    return normalizeExistingPaymentQr(
      readOptionalText(formData, `method-${method}-qrImageDataUrl`)
    );
  }

  if (!ALLOWED_PAYMENT_QR_TYPES.has(file.type)) {
    throw new Error("El QR debe ser PNG, JPG o WebP.");
  }

  if (file.size > MAX_PAYMENT_QR_BYTES) {
    throw new Error("El QR no puede superar 2 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

function normalizeExistingPaymentQr(value: string | null) {
  if (!value) {
    return null;
  }

  if (!value.startsWith("data:image/")) {
    return null;
  }

  if (value.length > MAX_PAYMENT_QR_BYTES * 2) {
    throw new Error("El QR guardado supera el tamano permitido.");
  }

  return value;
}

function parseOptionalDecimal(value: FormDataEntryValue | null, label: string) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = parseLocalizedDecimal(value).toDecimalPlaces(2);
  if (parsed.lt(0)) {
    throw new Error(`${label} no puede ser negativo.`);
  }

  return parsed;
}

function parseOptionalDate(value: FormDataEntryValue | null, label: string) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error(`${label} debe tener formato AAAA-MM-DD.`);
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${label} no es una fecha valida.`);
  }

  return date;
}

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
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
