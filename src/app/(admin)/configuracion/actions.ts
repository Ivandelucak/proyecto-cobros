"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BusinessType,
  MercadoPagoConnectionType,
  MercadoPagoEnvironment,
  MercadoPagoOperationMode,
  PaymentMethod,
  Prisma
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { BUSINESS_PROFILE_ID } from "@/lib/business-profile";
import {
  CASH_REGISTER_SETTING_ID,
  normalizeQuickProductsLimit
} from "@/lib/cash-register-settings";
import { parseLocalizedDecimal } from "@/lib/money";
import { DEFAULT_PAYMENT_METHOD_SETTINGS } from "@/lib/payment-options";
import {
  testMercadoPagoAccessToken,
  testMercadoPagoAccountConnection
} from "@/lib/mercadopago/mercado-pago-status";
import {
  MercadoPagoPosSetupError,
  type MercadoPagoPosSetupStep,
  setupMercadoPagoStoreAndPos,
  testMercadoPagoPosSetup,
  type MercadoPagoPosSetupInput
} from "@/lib/mercadopago/mercado-pago-pos";
import { createMercadoPagoOAuthAuthorizationUrl } from "@/lib/mercadopago/mercado-pago-oauth";
import { searchRecentMercadoPagoPayments } from "@/lib/mercadopago/mercado-pago-search";
import { protectMercadoPagoToken } from "@/lib/mercadopago/mercado-pago-secrets";
import { prisma } from "@/lib/prisma";
import { STOCK_SETTING_ID, parseOptionalStockDecimal } from "@/lib/stock-settings";
import { TICKET_SETTING_ID } from "@/lib/ticket-settings";

const MAX_LOGO_BYTES = 1_500_000;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const LOGO_EXTENSION_BY_MIME: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};
const LOGO_UPLOAD_ROUTE = "/uploads/logos";
const LOGO_UPLOAD_DIR = join(process.cwd(), "public", "uploads", "logos");
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
      error: businessProfileErrorMessage(error)
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
          ),
          mercadoPagoMode:
            method === PaymentMethod.MERCADOPAGO
              ? parseMercadoPagoMode(formData.get(`method-${method}-mercadoPagoMode`))
              : MercadoPagoOperationMode.MANUAL
        };
      })
    );
    const mercadoPagoAccounts = parseMercadoPagoAccounts(formData);
    const disconnectingMercadoPagoAccount = hasMercadoPagoDisconnectIntent(formData);

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
            fixedSurcharge: setting.fixedSurcharge,
            mercadoPagoMode: setting.mercadoPagoMode
          },
          create: setting
        });
      }

      await saveMercadoPagoAccounts(tx, mercadoPagoAccounts);

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

    return {
      success: disconnectingMercadoPagoAccount
        ? "Cuenta Mercado Pago desvinculada correctamente."
        : "Medios de pago guardados."
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar medios de pago."
    };
  }
}

export async function testMercadoPagoAccountAction(accountId: string) {
  await requireAdminPage();

  try {
    const result = await testMercadoPagoAccountConnection(accountId);
    await prisma.mercadoPagoAccount.update({
      where: { id: accountId },
      data: {
        ...(result.collectorId ? { collectorId: result.collectorId, mpUserId: result.collectorId } : {}),
        accountNickname: result.nickname ?? null,
        accountEmail: result.email ?? null,
        lastConnectionTestAt: result.testedAt ? new Date(result.testedAt) : new Date(),
        lastConnectionStatus: "OK",
        lastConnectionMessage: result.message,
        oauthRequiresReconnect: false
      }
    });
    revalidatePath("/configuracion");
    revalidatePath("/configuracion/pagos");
    return result;
  } catch (error) {
    await prisma.mercadoPagoAccount
      .update({
        where: { id: accountId },
        data: {
          lastConnectionTestAt: new Date(),
          lastConnectionStatus: "ERROR",
          lastConnectionMessage:
            error instanceof Error
              ? error.message
              : "No se pudo probar la conexion Mercado Pago."
        }
      })
      .catch(() => null);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo probar la conexion Mercado Pago."
    };
  }
}

export async function testMercadoPagoAccessTokenAction(accessToken: string) {
  await requireAdminPage();

  try {
    return await testMercadoPagoAccessToken(accessToken);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo probar la conexion Mercado Pago.",
      collectorId: null,
      nickname: null,
      email: null,
      testedAt: new Date().toISOString()
    };
  }
}

export async function createMercadoPagoOAuthLinkAction(
  environment: MercadoPagoEnvironment
) {
  await requireAdminPage();

  try {
    if (!Object.values(MercadoPagoEnvironment).includes(environment)) {
      throw new Error("Entorno Mercado Pago invalido.");
    }

    const link = createMercadoPagoOAuthAuthorizationUrl(environment);
    const qrCodeDataUrl = await QRCode.toDataURL(link.url, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 6,
      color: {
        dark: "#111827",
        light: "#FFFFFF"
      }
    });

    return {
      ok: true,
      url: link.url,
      qrCodeDataUrl,
      expiresAt: link.expiresAt,
      environment: link.environment,
      message: "Enlace de conexion Mercado Pago generado.",
      technicalDetail: null
    };
  } catch (error) {
    return {
      ok: false,
      url: null,
      qrCodeDataUrl: null,
      expiresAt: null,
      environment,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo generar el enlace OAuth de Mercado Pago.",
      technicalDetail:
        error instanceof Error
          ? JSON.stringify({ message: error.message }, null, 2)
          : null
    };
  }
}

export async function searchMercadoPagoMovementsAction(input: {
  accountId: string;
  minutes?: number;
  limit?: number;
}) {
  await requireAdminPage();

  try {
    const movements = await searchRecentMercadoPagoPayments({
      accountId: input.accountId,
      minutes: input.minutes ?? 120,
      limit: input.limit ?? 20,
      status: "approved"
    });

    return {
      ok: true,
      movements,
      message:
        movements.length > 0
          ? `${movements.length} cobro${movements.length === 1 ? "" : "s"} detectado${movements.length === 1 ? "" : "s"}.`
          : "Sin cobros aprobados en el rango seleccionado.",
      technicalDetail: null
    };
  } catch (error) {
    return {
      ok: false,
      movements: [],
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron consultar los cobros Mercado Pago.",
      technicalDetail:
        error instanceof Error
          ? JSON.stringify({ message: error.message }, null, 2)
          : null
    };
  }
}

export type MercadoPagoPosSetupActionInput = MercadoPagoPosSetupInput;

export async function setupMercadoPagoPosAction(
  accountId: string,
  input: MercadoPagoPosSetupActionInput
) {
  const user = await requireAdminPage();

  try {
    const result = await setupMercadoPagoStoreAndPos(accountId, input);
    await createAuditLog({
      userId: user.id,
      action: "MERCADOPAGO_POS_SETUP",
      entity: "MercadoPagoAccount",
      entityId: accountId,
      description: "Configuro sucursal y caja Mercado Pago.",
      metadata: {
        externalStoreId: result.externalStoreId,
        externalPosId: result.externalPosId,
        status: result.status
      }
    });
    revalidatePath("/configuracion");
    revalidatePath("/configuracion/pagos");
    return result;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo configurar la caja Mercado Pago.",
      status: "ERROR" as const,
      storeId: getStepStoreId(error),
      externalStoreId: getStepExternalStoreId(error) ?? input.externalStoreId,
      storeName: input.storeName,
      posId: getStepPosId(error),
      externalPosId: input.externalPosId,
      posName: input.posName,
      steps: getMercadoPagoPosSteps(error),
      technicalDetail: formatMercadoPagoPosTechnicalDetail(error)
    };
  }
}

export async function testMercadoPagoPosAction(
  accountId: string,
  input: Pick<MercadoPagoPosSetupActionInput, "externalStoreId" | "externalPosId">
) {
  const user = await requireAdminPage();

  try {
    const result = await testMercadoPagoPosSetup(accountId, input);
    await createAuditLog({
      userId: user.id,
      action: "MERCADOPAGO_POS_TEST",
      entity: "MercadoPagoAccount",
      entityId: accountId,
      description: "Probo caja Mercado Pago.",
      metadata: {
        externalStoreId: result.externalStoreId,
        externalPosId: result.externalPosId,
        status: result.status
      }
    });
    revalidatePath("/configuracion");
    revalidatePath("/configuracion/pagos");
    return result;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "No se pudo probar la caja Mercado Pago.",
      status: "ERROR" as const,
      storeId: getStepStoreId(error),
      externalStoreId: input.externalStoreId,
      storeName: "",
      posId: getStepPosId(error),
      externalPosId: input.externalPosId,
      posName: "",
      steps: getMercadoPagoPosSteps(error),
      technicalDetail: formatMercadoPagoPosTechnicalDetail(error)
    };
  }
}

function formatMercadoPagoPosTechnicalDetail(error: unknown) {
  if (error instanceof MercadoPagoPosSetupError) {
    return error.technicalDetail;
  }

  if (error instanceof Error) {
    return JSON.stringify({ message: error.message }, null, 2);
  }

  return null;
}

function getMercadoPagoPosSteps(error: unknown): MercadoPagoPosSetupStep[] {
  return error instanceof MercadoPagoPosSetupError ? error.steps : [];
}

function getStepStoreId(error: unknown) {
  return getMercadoPagoPosSteps(error)
    .slice()
    .reverse()
    .find((step) => step.storeId)?.storeId ?? null;
}

function getStepExternalStoreId(error: unknown) {
  return getMercadoPagoPosSteps(error)
    .slice()
    .reverse()
    .find((step) => step.externalStoreId)?.externalStoreId ?? null;
}

function getStepPosId(error: unknown) {
  return getMercadoPagoPosSteps(error)
    .slice()
    .reverse()
    .find((step) => step.posId)?.posId ?? null;
}

type MercadoPagoAccountInput = {
  id: string | null;
  name: string;
  enabled: boolean;
  environment: MercadoPagoEnvironment;
  accessToken: string | null;
  publicKey: string | null;
  collectorId: string | null;
  externalPosId: string | null;
  defaultAccount: boolean;
  instructions: string | null;
  enableAmountMatching: boolean;
  amountMatchingWindowMinutes: number;
  amountMatchingTolerance: Prisma.Decimal;
  amountMatchingAutoApprove: boolean;
  amountMatchingPollSeconds: number;
  showRecentMovements: boolean;
  deleteAccount: boolean;
};

function parseMercadoPagoAccounts(formData: FormData): MercadoPagoAccountInput[] {
  const defaultAccountValue =
    readText(formData, "mpDefaultAccountOverride") ||
    readText(formData, "mpDefaultAccount");
  const accounts = formData.getAll("mpAccountId").map((rawId) => {
    const id = String(rawId);
    return parseMercadoPagoAccountInput(formData, id, defaultAccountValue === id);
  });

  const newName = readText(formData, "newMp-name");
  const newToken = readText(formData, "newMp-accessToken");
  if (newName || newToken) {
    accounts.push(parseMercadoPagoAccountInput(formData, "new", defaultAccountValue === "new"));
  }

  return accounts;
}

function parseMercadoPagoAccountInput(
  formData: FormData,
  id: string,
  defaultAccount: boolean
): MercadoPagoAccountInput {
  const prefix = id === "new" ? "newMp" : `mp-${id}`;
  const environment = readText(formData, `${prefix}-environment`);

  if (!Object.values(MercadoPagoEnvironment).includes(environment as MercadoPagoEnvironment)) {
    throw new Error("Entorno Mercado Pago invalido.");
  }

  const windowMinutes = readPositiveInt(
    formData,
    `${prefix}-amountMatchingWindowMinutes`,
    10
  );
  const pollSeconds = readPositiveInt(
    formData,
    `${prefix}-amountMatchingPollSeconds`,
    5
  );

  return {
    id: id === "new" ? null : id,
    name: readText(formData, `${prefix}-name`),
    enabled: isChecked(formData, `${prefix}-enabled`),
    environment: environment as MercadoPagoEnvironment,
    accessToken: readOptionalText(formData, `${prefix}-accessToken`),
    publicKey: readOptionalText(formData, `${prefix}-publicKey`),
    collectorId: readOptionalText(formData, `${prefix}-collectorId`),
    externalPosId: parseOptionalMercadoPagoExternalId(
      formData,
      `${prefix}-externalPosId`,
      "External POS ID"
    ),
    defaultAccount,
    instructions: readOptionalText(formData, `${prefix}-instructions`),
    enableAmountMatching: isChecked(formData, `${prefix}-enableAmountMatching`),
    amountMatchingWindowMinutes: normalizeMercadoPagoOption(windowMinutes, [5, 10, 15, 30], 10),
    amountMatchingTolerance: parseOptionalDecimal(
      formData.get(`${prefix}-amountMatchingTolerance`),
      "La tolerancia de match"
    ) ?? new Prisma.Decimal(0),
    amountMatchingAutoApprove: isChecked(formData, `${prefix}-amountMatchingAutoApprove`),
    amountMatchingPollSeconds: normalizeMercadoPagoOption(pollSeconds, [5, 10, 15, 30], 5),
    showRecentMovements: isChecked(formData, `${prefix}-showRecentMovements`),
    deleteAccount: isChecked(formData, `${prefix}-deleteAccount`)
  };
}

function normalizeMercadoPagoOption(value: number, options: number[], fallback: number) {
  return options.includes(value) ? value : fallback;
}

async function saveMercadoPagoAccounts(
  tx: Prisma.TransactionClient,
  accounts: MercadoPagoAccountInput[]
) {
  const activeAccountInputs = accounts.filter((account) => !account.deleteAccount);
  const defaultCount = activeAccountInputs.filter((account) => account.defaultAccount).length;
  if (defaultCount > 1) {
    throw new Error("Solo una cuenta Mercado Pago puede quedar como predeterminada.");
  }

  if (defaultCount === 1) {
    await tx.mercadoPagoAccount.updateMany({
      where: { deletedAt: null },
      data: { defaultAccount: false }
    });
  }

  for (const account of accounts) {
    if (account.id && account.deleteAccount) {
      await tx.mercadoPagoAccount.update({
        where: { id: account.id },
        data: {
          enabled: false,
          defaultAccount: false,
          accessToken: protectMercadoPagoToken(`DISCONNECTED:${randomUUID()}`),
          oauthRefreshToken: null,
          oauthTokenExpiresAt: null,
          oauthScope: null,
          oauthConnectedAt: null,
          oauthLastRefreshAt: null,
          oauthRequiresReconnect: true,
          lastConnectionStatus: "DISCONNECTED",
          lastConnectionMessage: "Cuenta desvinculada desde Fox Point.",
          deletedAt: new Date()
        }
      });
      continue;
    }

    if (!account.name) {
      if (account.id) {
        throw new Error("Las cuentas Mercado Pago deben tener nombre.");
      }
      continue;
    }

    const data = {
      name: account.name,
      enabled: account.enabled,
      environment: account.environment,
      publicKey: account.publicKey,
      collectorId: account.collectorId,
      externalPosId: account.externalPosId,
      defaultAccount: account.defaultAccount,
      instructions: account.instructions,
      enableAmountMatching: account.enableAmountMatching,
      amountMatchingWindowMinutes: account.amountMatchingWindowMinutes,
      amountMatchingTolerance: account.amountMatchingTolerance,
      amountMatchingAutoApprove: account.amountMatchingAutoApprove,
      amountMatchingPollSeconds: account.amountMatchingPollSeconds,
      showRecentMovements: account.showRecentMovements,
      deletedAt: null
    };

    if (!account.id) {
      if (!account.accessToken) {
        throw new Error("La nueva cuenta Mercado Pago requiere Access Token.");
      }
      await tx.mercadoPagoAccount.create({
        data: {
          ...data,
          connectionType: MercadoPagoConnectionType.MANUAL_TOKEN,
          accessToken: protectMercadoPagoToken(account.accessToken)
        }
      });
      continue;
    }

    await tx.mercadoPagoAccount.update({
      where: { id: account.id },
      data: {
        ...data,
        ...(account.accessToken
          ? {
              connectionType: MercadoPagoConnectionType.MANUAL_TOKEN,
              accessToken: protectMercadoPagoToken(account.accessToken),
              oauthRefreshToken: null,
              oauthTokenExpiresAt: null,
              oauthScope: null,
              oauthConnectedAt: null,
              oauthLastRefreshAt: null,
              oauthRequiresReconnect: false
            }
          : {})
      }
    });
  }

  const defaultAccount = await tx.mercadoPagoAccount.findFirst({
    where: { deletedAt: null, enabled: true, defaultAccount: true },
    select: { id: true }
  });

  if (!defaultAccount) {
    const fallbackAccounts = await tx.mercadoPagoAccount.findMany({
      where: { deletedAt: null, enabled: true },
      select: {
        id: true,
        environment: true,
        name: true,
        createdAt: true
      }
    });
    const fallbackAccount = fallbackAccounts.sort((left, right) => {
      if (left.environment !== right.environment) {
        return left.environment === MercadoPagoEnvironment.PRODUCTION ? -1 : 1;
      }
      return left.createdAt.getTime() - right.createdAt.getTime();
    })[0];

    if (fallbackAccount) {
      await tx.mercadoPagoAccount.update({
        where: { id: fallbackAccount.id },
        data: { defaultAccount: true }
      });
    }
  }
}

function parseMercadoPagoMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? MercadoPagoOperationMode.MANUAL);
  return Object.values(MercadoPagoOperationMode).includes(
    mode as MercadoPagoOperationMode
  )
    ? (mode as MercadoPagoOperationMode)
    : MercadoPagoOperationMode.MANUAL;
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function hasMercadoPagoDisconnectIntent(formData: FormData) {
  for (const key of formData.keys()) {
    if (key.startsWith("mp-") && key.endsWith("-deleteAccount")) {
      return true;
    }
  }
  return false;
}

function readOptionalText(formData: FormData, key: string) {
  return readText(formData, key) || null;
}

function parseOptionalMercadoPagoExternalId(
  formData: FormData,
  key: string,
  label: string
) {
  const value = readOptionalText(formData, key);
  if (!value) {
    return null;
  }
  const normalized = value.toUpperCase();
  if (normalized.length > 39) {
    throw new Error(`${label} debe tener menos de 40 caracteres.`);
  }
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    throw new Error(`${label} solo puede tener letras y numeros.`);
  }
  return normalized;
}

async function resolveLogoUrl(formData: FormData) {
  const existingLogoUrl = readOptionalText(formData, "logoUrl");

  if (isChecked(formData, "removeLogo")) {
    await deleteLocalLogoIfManaged(existingLogoUrl);
    return null;
  }

  const file = formData.get("logoFile");
  if (!file || typeof file === "string" || file.size === 0) {
    return resolveExistingLogoUrl(existingLogoUrl);
  }

  const logoUrl = await saveUploadedLogoFile(file);
  await deleteLocalLogoIfManaged(existingLogoUrl);
  return logoUrl;
}

async function resolveExistingLogoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("data:image/")) {
    return saveDataUrlLogo(value);
  }

  if (isManagedLogoUrl(value)) {
    return value;
  }

  return null;
}

async function saveUploadedLogoFile(file: File) {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error("Formato no permitido. Usa PNG, JPG o WebP.");
  }

  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("El logo supera el maximo permitido de 1.5 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  return saveLogoBuffer(bytes, file.type);
}

async function saveDataUrlLogo(value: string) {
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    value
  );
  if (!match) {
    throw new Error(
      "No se pudo guardar el logo. Verifica que sea PNG, JPG o WebP y que pese menos de 1.5 MB."
    );
  }

  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_LOGO_BYTES) {
    throw new Error("El logo supera el maximo permitido de 1.5 MB.");
  }

  return saveLogoBuffer(bytes, mimeType);
}

async function saveLogoBuffer(bytes: Buffer, mimeType: string) {
  const extension = LOGO_EXTENSION_BY_MIME[mimeType];
  if (!extension) {
    throw new Error("Formato no permitido. Usa PNG, JPG o WebP.");
  }

  try {
    await mkdir(LOGO_UPLOAD_DIR, { recursive: true });
    const filename = `business-logo-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
    await writeFile(join(LOGO_UPLOAD_DIR, filename), bytes);
    return `${LOGO_UPLOAD_ROUTE}/${filename}`;
  } catch (error) {
    console.error("Business logo upload failed", error);
    throw new Error(
      "No se pudo guardar el logo. Verifica que sea PNG, JPG o WebP y que pese menos de 1.5 MB."
    );
  }
}

function isManagedLogoUrl(value: string) {
  return /^\/uploads\/logos\/[A-Za-z0-9._-]+$/.test(value);
}

async function deleteLocalLogoIfManaged(value: string | null) {
  if (!value || !isManagedLogoUrl(value)) {
    return;
  }

  const filename = value.slice(`${LOGO_UPLOAD_ROUTE}/`.length);
  try {
    await unlink(join(LOGO_UPLOAD_DIR, filename));
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return;
    }
    console.error("Business logo delete failed", error);
  }
}

function businessProfileErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "No se pudo guardar la configuracion.";
  }

  if (
    error.message.includes("logoUrl") ||
    error.message.includes("column is too long") ||
    error.message.includes("too long for the column")
  ) {
    return "No se pudo guardar el logo. Verifica que sea PNG, JPG o WebP y que pese menos de 1.5 MB.";
  }

  return error.message;
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
