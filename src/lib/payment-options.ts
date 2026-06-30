import { MercadoPagoOperationMode, PaymentMethod } from "@prisma/client";

export const DEFAULT_PAYMENT_METHOD_SETTINGS = [
  {
    method: PaymentMethod.CASH,
    label: "Efectivo",
    enabled: true,
    sortOrder: 10,
    instructions: null,
    alias: null,
    cbu: null,
    cvu: null,
    accountHolder: null,
    accountCuit: null,
    bankName: null,
    qrImageDataUrl: null,
    askReference: false,
    defaultProviderStatus: null,
    surchargeRate: null,
    fixedSurcharge: null,
    mercadoPagoMode: MercadoPagoOperationMode.MANUAL
  },
  {
    method: PaymentMethod.DEBIT,
    label: "Debito",
    enabled: true,
    sortOrder: 20,
    instructions: "Confirmar autorizacion en el posnet antes de cerrar la venta.",
    alias: null,
    cbu: null,
    cvu: null,
    accountHolder: null,
    accountCuit: null,
    bankName: null,
    qrImageDataUrl: null,
    askReference: false,
    defaultProviderStatus: "ACREDITADO",
    surchargeRate: null,
    fixedSurcharge: null,
    mercadoPagoMode: MercadoPagoOperationMode.MANUAL
  },
  {
    method: PaymentMethod.CREDIT,
    label: "Credito",
    enabled: true,
    sortOrder: 30,
    instructions: "Confirmar cupon, lote o autorizacion en el posnet.",
    alias: null,
    cbu: null,
    cvu: null,
    accountHolder: null,
    accountCuit: null,
    bankName: null,
    qrImageDataUrl: null,
    askReference: false,
    defaultProviderStatus: "ACREDITADO",
    surchargeRate: null,
    fixedSurcharge: null,
    mercadoPagoMode: MercadoPagoOperationMode.MANUAL
  },
  {
    method: PaymentMethod.TRANSFER,
    label: "Transferencia",
    enabled: true,
    sortOrder: 40,
    instructions: "Verificar el comprobante antes de finalizar la venta.",
    alias: null,
    cbu: null,
    cvu: null,
    accountHolder: null,
    accountCuit: null,
    bankName: null,
    qrImageDataUrl: null,
    askReference: false,
    defaultProviderStatus: "MANUAL_CONFIRMED",
    surchargeRate: null,
    fixedSurcharge: null,
    mercadoPagoMode: MercadoPagoOperationMode.MANUAL
  },
  {
    method: PaymentMethod.MERCADOPAGO,
    label: "Mercado Pago",
    enabled: true,
    sortOrder: 50,
    instructions: "Solicitar comprobante o verificar acreditacion manual.",
    alias: null,
    cbu: null,
    cvu: null,
    accountHolder: null,
    accountCuit: null,
    bankName: null,
    qrImageDataUrl: null,
    askReference: false,
    defaultProviderStatus: "MANUAL_CONFIRMED",
    surchargeRate: null,
    fixedSurcharge: null,
    mercadoPagoMode: MercadoPagoOperationMode.MANUAL
  },
  {
    method: PaymentMethod.CURRENT_ACCOUNT,
    label: "Cuenta corriente",
    enabled: true,
    sortOrder: 60,
    instructions: "Seleccionar el cliente antes de cargar el saldo a cuenta.",
    alias: null,
    cbu: null,
    cvu: null,
    accountHolder: null,
    accountCuit: null,
    bankName: null,
    qrImageDataUrl: null,
    askReference: false,
    defaultProviderStatus: null,
    surchargeRate: null,
    fixedSurcharge: null,
    mercadoPagoMode: MercadoPagoOperationMode.MANUAL
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
