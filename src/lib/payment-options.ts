export const CREDIT_INSTALLMENT_OPTIONS = [
  { installments: 1, surchargeRate: 0 },
  { installments: 2, surchargeRate: 10 },
  { installments: 3, surchargeRate: 15 },
  { installments: 6, surchargeRate: 25 },
  { installments: 12, surchargeRate: 45 }
] as const;

export type CreditInstallments = (typeof CREDIT_INSTALLMENT_OPTIONS)[number]["installments"];

export function getCreditInstallmentOption(installments: number) {
  return CREDIT_INSTALLMENT_OPTIONS.find((option) => option.installments === installments);
}
