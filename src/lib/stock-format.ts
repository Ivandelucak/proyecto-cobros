import { Prisma, UnitType } from "@prisma/client";

const DECIMAL_UNITS = new Set<UnitType>([
  UnitType.KG,
  UnitType.GR,
  UnitType.LITER,
  UnitType.METER
]);

export function shouldUseDecimalQuantity(unitType: UnitType) {
  return DECIMAL_UNITS.has(unitType);
}

export function formatStock(value: Prisma.Decimal | number | string, unitType: UnitType) {
  const decimal = new Prisma.Decimal(value);
  const decimals = shouldUseDecimalQuantity(unitType) && !decimal.mod(1).equals(0) ? 3 : 0;

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(decimal.toNumber());
}
