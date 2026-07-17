export function parseEditableDecimal(value: string) {
  const clean = value.trim().replace(/\$/g, "").replace(/\s/g, "");

  if (!clean) {
    return null;
  }

  const normalized =
    clean.includes(",") && clean.includes(".")
      ? clean.lastIndexOf(",") > clean.lastIndexOf(".")
        ? clean.replace(/\./g, "").replace(",", ".")
        : clean.replace(/,/g, "")
      : clean.replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateSalePriceIncrease(originalSalePrice: string, percentage: string) {
  if (!percentage.trim()) {
    return null;
  }

  const original = parseEditableDecimal(originalSalePrice);
  const percent = parseEditableDecimal(percentage);

  if (original === null || percent === null || percent < 0) {
    return null;
  }

  return roundMoney(original * (1 + percent / 100));
}

export function formatEditableMoney(value: number) {
  return value.toFixed(2);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
