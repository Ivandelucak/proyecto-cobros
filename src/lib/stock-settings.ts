import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const STOCK_SETTING_ID = "default";

export type StockSettingView = {
  lowStockEnabled: boolean;
  defaultMinStock: string | null;
  allowManualStockAdjustment: boolean;
  showLowStockWarnings: boolean;
};

export function getDefaultStockSetting(): StockSettingView {
  return {
    lowStockEnabled: true,
    defaultMinStock: null,
    allowManualStockAdjustment: true,
    showLowStockWarnings: true
  };
}

export async function getStockSetting(businessId?: string) {
  if (!businessId) {
    return getDefaultStockSetting();
  }
  const setting = await prisma.stockSetting.findUnique({
    where: { businessId }
  });

  return setting
    ? {
        lowStockEnabled: setting.lowStockEnabled,
        defaultMinStock: setting.defaultMinStock?.toString() ?? null,
        allowManualStockAdjustment: setting.allowManualStockAdjustment,
        showLowStockWarnings: setting.showLowStockWarnings
      }
    : getDefaultStockSetting();
}

export function parseOptionalStockDecimal(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) {
    return null;
  }

  const decimal = new Prisma.Decimal(text).toDecimalPlaces(3);
  if (decimal.lt(0)) {
    throw new Error("El stock minimo por defecto no puede ser negativo.");
  }

  return decimal;
}
