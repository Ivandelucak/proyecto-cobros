export type PriceAdjustmentDirection = "increase" | "decrease";
export type PriceRounding = "none" | "10" | "50" | "100";

export function parseEditableDecimal(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeEditableDecimal(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeEditableDecimal(value: string) {
  const clean = value.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!clean || !/^[+-]?[0-9][0-9.,]*$/.test(clean)) {
    return null;
  }

  const unsigned = clean.startsWith("-") || clean.startsWith("+") ? clean.slice(1) : clean;
  const sign = clean.startsWith("-") ? "-" : "";
  const hasComma = unsigned.includes(",");
  const hasDot = unsigned.includes(".");
  let normalized = unsigned;

  if (hasComma && hasDot) {
    normalized =
      unsigned.lastIndexOf(",") > unsigned.lastIndexOf(".")
        ? unsigned.replace(/\./g, "").replace(",", ".")
        : unsigned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = unsigned.replace(",", ".");
  } else if (hasDot) {
    const parts = unsigned.split(".");
    const looksLikeThousands =
      parts.length > 1 &&
      parts[0].length <= 3 &&
      parts.slice(1).every((part) => part.length === 3);
    normalized = looksLikeThousands ? parts.join("") : unsigned;
  }

  return Number.isFinite(Number(`${sign}${normalized}`)) ? `${sign}${normalized}` : null;
}

export function calculatePercentagePrice(
  originalSalePrice: string | number,
  percentage: string | number,
  direction: PriceAdjustmentDirection = "increase"
) {
  const original = parseEditableDecimal(originalSalePrice);
  const percent = parseEditableDecimal(percentage);

  if (
    original === null ||
    percent === null ||
    original < 0 ||
    percent < 0 ||
    (direction === "decrease" && percent > 100)
  ) {
    return null;
  }

  const factor = direction === "increase" ? 1 + percent / 100 : 1 - percent / 100;
  return roundMoney(original * factor);
}

export function calculateSalePriceIncrease(originalSalePrice: string, percentage: string) {
  if (!percentage.trim()) {
    return null;
  }

  return calculatePercentagePrice(originalSalePrice, percentage, "increase");
}

export function calculatePriceFromCostProfit(cost: string, profitPercentage: string) {
  const parsedCost = parseEditableDecimal(cost);
  const parsedPercentage = parseEditableDecimal(profitPercentage);

  if (
    !profitPercentage.trim() ||
    parsedCost === null ||
    parsedPercentage === null ||
    parsedCost <= 0 ||
    parsedPercentage < -100
  ) {
    return null;
  }

  return roundMoney(parsedCost * (1 + parsedPercentage / 100));
}

export function calculateProfitPercentageFromCost(
  salePrice: string | number,
  cost: string | number
) {
  const parsedSalePrice = parseEditableDecimal(salePrice);
  const parsedCost = parseEditableDecimal(cost);

  if (parsedSalePrice === null || parsedCost === null || parsedCost <= 0) {
    return null;
  }

  return roundMoney(((parsedSalePrice - parsedCost) / parsedCost) * 100);
}

export function formatEditablePercentage(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  return roundMoney(value).toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(".", ",");
}

export function applyPriceRounding(value: number, rounding: PriceRounding) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  if (rounding === "none") {
    return roundMoney(value);
  }

  const step = Number(rounding);
  return roundMoney(Math.round(value / step) * step);
}

export function formatEditableMoney(value: number) {
  return roundMoney(value).toFixed(2);
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
