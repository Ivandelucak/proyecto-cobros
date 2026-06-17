import { Prisma } from "@prisma/client";

export type MoneyInput = Prisma.Decimal | number | string;

export function toDecimal(value: MoneyInput) {
  return new Prisma.Decimal(value);
}

export function formatARS(value: MoneyInput) {
  const amount = Number(value.toString());

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function parseLocalizedDecimal(value: unknown) {
  if (typeof value === "number") {
    return new Prisma.Decimal(value);
  }

  if (typeof value !== "string") {
    throw new Error("El valor numerico es invalido.");
  }

  const cleanValue = value
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "");
  const normalized = normalizeDecimalString(cleanValue);

  if (!normalized || Number.isNaN(Number(normalized))) {
    throw new Error("El valor numerico es invalido.");
  }

  return new Prisma.Decimal(normalized);
}

function normalizeDecimalString(value: string) {
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  if (hasComma && hasDot) {
    return value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  }

  if (hasComma) {
    return value.replace(",", ".");
  }

  if (hasDot) {
    const parts = value.split(".");
    const looksLikeThousands =
      parts.length > 1 &&
      parts[0].length <= 3 &&
      parts.slice(1).every((part) => part.length === 3);

    return looksLikeThousands ? parts.join("") : value;
  }

  return value;
}
