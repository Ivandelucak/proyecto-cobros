import { Prisma } from "@prisma/client";

export type ProductUtility = {
  amount: Prisma.Decimal;
  percentage: Prisma.Decimal | null;
  state: "positive" | "zero" | "negative" | "zero_cost" | "missing_cost";
};

export function calculateProductUtility(
  salePrice: Prisma.Decimal,
  cost: Prisma.Decimal | null | undefined
): ProductUtility {
  if (cost === null || cost === undefined) {
    return {
      amount: new Prisma.Decimal(0),
      percentage: null,
      state: "missing_cost"
    };
  }

  const amount = salePrice.minus(cost).toDecimalPlaces(2);

  if (cost.equals(0)) {
    return {
      amount,
      percentage: null,
      state: "zero_cost"
    };
  }

  const percentage = amount.div(cost).mul(100).toDecimalPlaces(2);

  return {
    amount,
    percentage,
    state: amount.gt(0) ? "positive" : amount.lt(0) ? "negative" : "zero"
  };
}

export function formatUtilityPercentage(value: Prisma.Decimal) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value.toString()));
}
