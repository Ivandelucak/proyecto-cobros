import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CASH_REGISTER_SETTING_ID = "default";

type CashRegisterSettingsClient = Prisma.TransactionClient | typeof prisma;

export type CashRegisterSettingView = {
  requireOpenSession: boolean;
  showExpectedCashToCashier: boolean;
  allowCashierCancelSale: boolean;
  allowNegativeStock: boolean;
  defaultSearchMode: string | null;
  quickProductsLimit: number;
};

export function getDefaultCashRegisterSetting(): CashRegisterSettingView {
  return {
    requireOpenSession: true,
    showExpectedCashToCashier: false,
    allowCashierCancelSale: false,
    allowNegativeStock: false,
    defaultSearchMode: null,
    quickProductsLimit: 12
  };
}

export async function getCashRegisterSetting(
  client: CashRegisterSettingsClient = prisma
): Promise<CashRegisterSettingView> {
  const setting = await client.cashRegisterSetting.findUnique({
    where: { id: CASH_REGISTER_SETTING_ID }
  });

  return setting ?? getDefaultCashRegisterSetting();
}

export function normalizeQuickProductsLimit(value: number) {
  if (!Number.isFinite(value)) {
    return 12;
  }

  return Math.min(Math.max(Math.trunc(value), 4), 48);
}
