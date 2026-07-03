import { Prisma } from "@prisma/client";

export function normalizeMercadoPagoPollSeconds(value: number | null | undefined) {
  return Math.max(5, Math.min(Math.trunc(value ?? 5), 30));
}

export function isMercadoPagoApprovedStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  return ["approved", "accredited", "paid"].includes(normalized);
}

export function isMercadoPagoAmountMatch(input: {
  amount: Prisma.Decimal.Value;
  targetAmount: Prisma.Decimal.Value;
  tolerance: Prisma.Decimal.Value;
}) {
  const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  const targetAmount = new Prisma.Decimal(input.targetAmount).toDecimalPlaces(2);
  const tolerance = new Prisma.Decimal(input.tolerance).toDecimalPlaces(2);

  return amount.minus(targetAmount).abs().lte(tolerance);
}

export function isExactMercadoPagoAmountMatch(input: {
  amount: Prisma.Decimal.Value;
  targetAmount: Prisma.Decimal.Value;
}) {
  return new Prisma.Decimal(input.amount)
    .toDecimalPlaces(2)
    .equals(new Prisma.Decimal(input.targetAmount).toDecimalPlaces(2));
}
