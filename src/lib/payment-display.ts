import { PaymentMethod } from "@prisma/client";

export const fallbackPaymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

export const providerStatusLabels: Record<string, string> = {
  MANUAL_CONFIRMED: "Confirmado manualmente",
  ACREDITADO: "Acreditado",
  AUTHORIZED: "Autorizado",
  PENDING: "Pendiente",
  FAILED: "Fallido"
};

export function providerStatusLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return providerStatusLabels[value] ?? value;
}
