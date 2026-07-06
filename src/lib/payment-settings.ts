import { MercadoPagoOperationMode, PaymentMethod, Prisma } from "@prisma/client";
import {
  CREDIT_INSTALLMENT_OPTIONS,
  DEFAULT_PAYMENT_METHOD_SETTINGS
} from "@/lib/payment-options";
import { prisma } from "@/lib/prisma";

type PaymentSettingsClient = Prisma.TransactionClient | typeof prisma;

export type PaymentMethodSettingView = {
  method: PaymentMethod;
  label: string;
  displayName: string;
  enabled: boolean;
  sortOrder: number;
  instructions: string | null;
  alias: string | null;
  cbu: string | null;
  cvu: string | null;
  accountHolder: string | null;
  accountCuit: string | null;
  bankName: string | null;
  qrImageDataUrl: string | null;
  askReference: boolean;
  defaultProviderStatus: string | null;
  surchargeRate: string | null;
  fixedSurcharge: string | null;
  mercadoPagoMode: MercadoPagoOperationMode;
};

export type CreditInstallmentPlanView = {
  id: string;
  installments: number;
  surchargeRate: string;
  active: boolean;
};

export async function getPaymentMethodSettings(businessId?: string, client: PaymentSettingsClient = prisma) {
  const rows = businessId
    ? await client.paymentMethodSetting.findMany({
        where: { businessId },
        orderBy: [{ sortOrder: "asc" }, { method: "asc" }]
      })
    : await client.paymentMethodSetting.findMany({
        orderBy: [{ sortOrder: "asc" }, { method: "asc" }]
      });

  if (rows.length === 0) {
    return DEFAULT_PAYMENT_METHOD_SETTINGS.map((setting) => ({
      ...setting,
      displayName: setting.label
    }));
  }

  const rowsByMethod = new Map(rows.map((row) => [row.method, row]));

  return DEFAULT_PAYMENT_METHOD_SETTINGS.map((fallback) => {
    const row = rowsByMethod.get(fallback.method);
    const label = row?.label ?? fallback.label;

    return {
      method: row?.method ?? fallback.method,
      label,
      displayName: label,
      enabled: row?.enabled ?? fallback.enabled,
      sortOrder: row?.sortOrder ?? fallback.sortOrder,
      instructions: row?.instructions ?? fallback.instructions,
      alias: row?.alias ?? fallback.alias,
      cbu: row?.cbu ?? fallback.cbu,
      cvu: row?.cvu ?? fallback.cvu,
      accountHolder: row?.accountHolder ?? fallback.accountHolder,
      accountCuit: row?.accountCuit ?? fallback.accountCuit,
      bankName: row?.bankName ?? fallback.bankName,
      qrImageDataUrl: row?.qrImageDataUrl ?? fallback.qrImageDataUrl,
      askReference: row?.askReference ?? fallback.askReference,
      defaultProviderStatus:
        row?.defaultProviderStatus ?? fallback.defaultProviderStatus,
      surchargeRate: row?.surchargeRate?.toString() ?? fallback.surchargeRate,
      fixedSurcharge: row?.fixedSurcharge?.toString() ?? fallback.fixedSurcharge,
      mercadoPagoMode:
        row?.mercadoPagoMode ?? fallback.mercadoPagoMode ?? MercadoPagoOperationMode.MANUAL
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function getEnabledPaymentMethodSettings(
  businessId?: string,
  client: PaymentSettingsClient = prisma
) {
  return (await getPaymentMethodSettings(businessId, client)).filter((setting) => setting.enabled);
}

export async function getCreditInstallmentPlans(client: PaymentSettingsClient = prisma) {
  const rows = await client.creditInstallmentPlan.findMany({
    orderBy: { installments: "asc" }
  });

  if (rows.length === 0) {
    return CREDIT_INSTALLMENT_OPTIONS.map((option) => ({
      id: `default-${option.installments}`,
      installments: option.installments,
      surchargeRate: String(option.surchargeRate),
      active: true
    }));
  }

  return rows.map((row) => ({
    id: row.id,
    installments: row.installments,
    surchargeRate: row.surchargeRate.toString(),
    active: row.active
  }));
}

export async function getActiveCreditInstallmentPlans(
  client: PaymentSettingsClient = prisma
) {
  return (await getCreditInstallmentPlans(client)).filter((plan) => plan.active);
}
