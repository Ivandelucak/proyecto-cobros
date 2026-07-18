import { Prisma } from "@prisma/client";
import { normalizeEditableDecimal } from "@/lib/product-price-adjustment";

export type MoneyInput = Prisma.Decimal | number | string;

export function toDecimal(value: MoneyInput) {
  return new Prisma.Decimal(value);
}

export function formatARS(value: MoneyInput) {
  return formatMoney(value, "ARS", "es-AR");
}

export function formatMoney(value: MoneyInput, currency = "ARS", locale = "es-AR") {
  const amount = Number(value.toString());

  return new Intl.NumberFormat(locale || "es-AR", {
    style: "currency",
    currency: currency || "ARS",
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

  const normalized = normalizeEditableDecimal(value);

  if (!normalized || Number.isNaN(Number(normalized))) {
    throw new Error("El valor numerico es invalido.");
  }

  return new Prisma.Decimal(normalized);
}
