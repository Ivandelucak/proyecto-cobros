import QRCode from "qrcode";
import { PaymentAttemptStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mercadoPagoRequest } from "./mercado-pago-client";
import { getMercadoPagoAccountWithToken } from "./mercado-pago-accounts";
import type {
  MercadoPagoAttemptView,
  MercadoPagoOrderResponse
} from "./mercado-pago-types";

export async function createMercadoPagoQrOrder(input: {
  accountId: string;
  amount: Prisma.Decimal.Value;
}) {
  const account = await getMercadoPagoAccountWithToken(input.accountId);
  if (!account) {
    throw new Error("La cuenta de Mercado Pago no esta disponible.");
  }
  if (!account.accessToken.trim()) {
    throw new Error("La cuenta Mercado Pago no tiene Access Token cargado.");
  }
  if (!account.externalPosId?.trim()) {
    throw new Error(
      "Falta configurar la caja Mercado Pago. Crea una caja/POS antes de generar QR."
    );
  }

  const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  if (amount.lte(0)) {
    throw new Error("El monto debe ser mayor a cero.");
  }
  const amountText = amount.toFixed(2);

  const externalReference = createExternalReference();
  validateExternalReference(externalReference);
  const attempt = await prisma.paymentAttempt.create({
    data: {
      mercadoPagoAccountId: account.id,
      externalReference,
      amount,
      status: PaymentAttemptStatus.PENDING,
      origin: "QR_ORDER"
    },
    include: { mercadoPagoAccount: true }
  });

  try {
    const body = compactObject({
      type: "qr",
      total_amount: amountText,
      description: `Venta POS Universal #${attempt.id.slice(-8)}`,
      external_reference: externalReference,
      config: {
        qr: {
          mode: "dynamic",
          external_pos_id: account.externalPosId.trim()
        }
      },
      transactions: {
        payments: [
          {
            amount: amountText
          }
        ]
      }
    });

    const order = await mercadoPagoRequest<MercadoPagoOrderResponse>({
      accessToken: account.accessToken,
      path: "/v1/orders",
      method: "POST",
      idempotencyKey: attempt.id,
      body
    });

    const status = mapMercadoPagoOrderStatus(order);
    const payment = firstPayment(order);
    const qrData = order.type_response?.qr_data ?? null;

    const updated = await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerOrderId: order.id ?? null,
        providerPaymentId: payment?.id ? String(payment.id) : null,
        status,
        qrData,
        rawStatus: order.status ?? null,
        rawStatusDetail: order.status_detail ?? null,
        lastCheckedAt: new Date(),
        approvedAt: status === PaymentAttemptStatus.APPROVED ? new Date() : null
      },
      include: { mercadoPagoAccount: true }
    });

    return toAttemptView(updated);
  } catch (error) {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentAttemptStatus.ERROR,
        rawStatus: "api_error",
        rawStatusDetail: error instanceof Error ? error.message.slice(0, 180) : null,
        lastCheckedAt: new Date()
      }
    });
    throw error;
  }
}

export async function getMercadoPagoOrderStatus(input: { attemptId: string }) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    include: { mercadoPagoAccount: true }
  });

  if (!attempt) {
    throw new Error("No se encontro el intento de pago.");
  }

  if (!attempt.providerOrderId) {
    return toAttemptView(attempt);
  }

  const order = await mercadoPagoRequest<MercadoPagoOrderResponse>({
    accessToken: attempt.mercadoPagoAccount.accessToken,
    path: `/v1/orders/${attempt.providerOrderId}`
  });
  const status = mapMercadoPagoOrderStatus(order);
  const payment = firstPayment(order);

  const updated = await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      providerPaymentId: payment?.id ? String(payment.id) : attempt.providerPaymentId,
      status,
      rawStatus: order.status ?? null,
      rawStatusDetail: order.status_detail ?? payment?.status_detail ?? null,
      lastCheckedAt: new Date(),
      approvedAt:
        status === PaymentAttemptStatus.APPROVED
          ? attempt.approvedAt ?? new Date()
          : attempt.approvedAt
    },
    include: { mercadoPagoAccount: true }
  });

  return toAttemptView(updated);
}

export async function cancelMercadoPagoAttempt(input: { attemptId: string }) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    include: { mercadoPagoAccount: true }
  });

  if (!attempt) {
    throw new Error("No se encontro el intento de pago.");
  }

  if (attempt.status === PaymentAttemptStatus.APPROVED) {
    throw new Error("No se puede cancelar un pago aprobado.");
  }

  const updated = await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: PaymentAttemptStatus.CANCELLED,
      rawStatus: attempt.rawStatus ?? "cancelled_by_cashier",
      lastCheckedAt: new Date()
    },
    include: { mercadoPagoAccount: true }
  });

  return toAttemptView(updated);
}

export async function toAttemptView(attempt: {
  id: string;
  mercadoPagoAccountId: string;
  mercadoPagoAccount: { name: string };
  amount: Prisma.Decimal;
  externalReference: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentAttemptStatus;
  origin: "QR_ORDER" | "AMOUNT_MATCH" | "MANUAL_REFERENCE";
  qrData: string | null;
  checkoutUrl: string | null;
  rawStatus: string | null;
  rawStatusDetail: string | null;
  approvedAt: Date | null;
}): Promise<MercadoPagoAttemptView> {
  const qrCodeDataUrl = attempt.qrData
    ? await QRCode.toDataURL(attempt.qrData, {
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 6
      })
    : null;

  return {
    id: attempt.id,
    accountId: attempt.mercadoPagoAccountId,
    accountName: attempt.mercadoPagoAccount.name,
    amount: attempt.amount.toString(),
    externalReference: attempt.externalReference,
    providerOrderId: attempt.providerOrderId,
    providerPaymentId: attempt.providerPaymentId,
    status: attempt.status,
    origin: attempt.origin,
    qrData: attempt.qrData,
    qrCodeDataUrl,
    checkoutUrl: attempt.checkoutUrl,
    rawStatus: attempt.rawStatus,
    rawStatusDetail: attempt.rawStatusDetail,
    approvedAt: attempt.approvedAt?.toISOString() ?? null
  };
}

function mapMercadoPagoOrderStatus(order: MercadoPagoOrderResponse) {
  const payment = firstPayment(order);
  const status = String(payment?.status ?? order.status ?? "").toLowerCase();
  const detail = String(payment?.status_detail ?? order.status_detail ?? "").toLowerCase();

  if (status === "approved" || status === "paid" || detail === "accredited") {
    return PaymentAttemptStatus.APPROVED;
  }
  if (["rejected", "failed"].includes(status)) {
    return PaymentAttemptStatus.REJECTED;
  }
  if (["cancelled", "canceled"].includes(status)) {
    return PaymentAttemptStatus.CANCELLED;
  }
  if (status === "expired") {
    return PaymentAttemptStatus.EXPIRED;
  }
  if (status === "error") {
    return PaymentAttemptStatus.ERROR;
  }

  return PaymentAttemptStatus.PENDING;
}

function firstPayment(order: MercadoPagoOrderResponse) {
  return order.transactions?.payments?.[0] ?? null;
}

function createExternalReference() {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `sale_${Date.now()}_payment_${random}`.slice(0, 64);
}

function validateExternalReference(value: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new Error("La referencia externa Mercado Pago no es valida.");
  }
}

function compactObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compactObject(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null)
      .map(([key, entryValue]) => [key, compactObject(entryValue)])
  ) as T;
}
