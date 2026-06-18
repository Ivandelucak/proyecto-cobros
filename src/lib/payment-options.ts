import { PaymentMethod } from "@prisma/client";

export const DEFAULT_PAYMENT_METHOD_SETTINGS = [
  { method: PaymentMethod.CASH, label: "Efectivo", enabled: true, sortOrder: 10 },
  { method: PaymentMethod.DEBIT, label: "Debito", enabled: true, sortOrder: 20 },
  { method: PaymentMethod.CREDIT, label: "Credito", enabled: true, sortOrder: 30 },
  {
    method: PaymentMethod.TRANSFER,
    label: "Transferencia",
    enabled: true,
    sortOrder: 40
  },
  {
    method: PaymentMethod.MERCADOPAGO,
    label: "MercadoPago",
    enabled: true,
    sortOrder: 50
  },
  {
    method: PaymentMethod.CURRENT_ACCOUNT,
    label: "Cuenta corriente",
    enabled: true,
    sortOrder: 60
  }
] as const;

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
