import { PaymentMethod, Prisma } from "@prisma/client";
import {
  CREDIT_INSTALLMENT_OPTIONS,
  DEFAULT_PAYMENT_METHOD_SETTINGS
} from "@/lib/payment-options";
import { prisma } from "@/lib/prisma";

type PaymentSettingsClient = Prisma.TransactionClient | typeof prisma;

export type PaymentMethodSettingView = {
  method: PaymentMethod;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export type CreditInstallmentPlanView = {
  id: string;
  installments: number;
  surchargeRate: string;
  active: boolean;
};

export async function getPaymentMethodSettings(client: PaymentSettingsClient = prisma) {
  const rows = await client.paymentMethodSetting.findMany({
    orderBy: [{ sortOrder: "asc" }, { method: "asc" }]
  });

  if (rows.length === 0) {
    return DEFAULT_PAYMENT_METHOD_SETTINGS.map((setting) => ({ ...setting }));
  }

  const rowsByMethod = new Map(rows.map((row) => [row.method, row]));

  return DEFAULT_PAYMENT_METHOD_SETTINGS.map((fallback) => {
    const row = rowsByMethod.get(fallback.method);
    return row
      ? {
          method: row.method,
          label: row.label,
          enabled: row.enabled,
          sortOrder: row.sortOrder
        }
      : { ...fallback };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function getEnabledPaymentMethodSettings(
  client: PaymentSettingsClient = prisma
) {
  return (await getPaymentMethodSettings(client)).filter((setting) => setting.enabled);
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
