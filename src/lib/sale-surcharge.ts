export const saleSurchargeTypes = ["PERCENTAGE", "FIXED"] as const;

export type SaleSurchargeType = (typeof saleSurchargeTypes)[number];

export type SaleSurchargeInput = {
  type: SaleSurchargeType;
  value: string;
};

export function isSaleSurchargeType(value: unknown): value is SaleSurchargeType {
  return typeof value === "string" && saleSurchargeTypes.includes(value as SaleSurchargeType);
}

export function saleSurchargeLabel(type: SaleSurchargeType, value: string | number) {
  return type === "PERCENTAGE" ? `Recargo ${value}%` : "Recargo";
}
