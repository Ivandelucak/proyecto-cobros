import { PaymentAttemptStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { mercadoPagoRequest } from "@/lib/mercadopago/mercado-pago-client";
import type { MercadoPagoPaymentSearchResult } from "@/lib/mercadopago/mercado-pago-types";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const payload = await request.json().catch(() => null);
  const paymentId = extractPaymentId(payload) ?? url.searchParams.get("id");

  if (paymentId) {
    await syncMercadoPagoPayment(String(paymentId));
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

async function syncMercadoPagoPayment(paymentId: string) {
  const accounts = await prisma.mercadoPagoAccount.findMany({
    where: {
      enabled: true,
      deletedAt: null
    }
  });

  for (const account of accounts) {
    try {
      const payment = await mercadoPagoRequest<MercadoPagoPaymentSearchResult>({
        accessToken: account.accessToken,
        path: `/v1/payments/${paymentId}`
      });
      const externalReference = payment.external_reference ?? null;
      const attempt = await prisma.paymentAttempt.findFirst({
        where: {
          mercadoPagoAccountId: account.id,
          OR: [
            { providerPaymentId: paymentId },
            ...(externalReference ? [{ externalReference }] : [])
          ]
        },
        select: {
          id: true,
          approvedAt: true
        }
      });

      if (!attempt) {
        continue;
      }

      const status = mapPaymentStatus(payment);
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerPaymentId: paymentId,
          status,
          rawStatus: payment.status ?? null,
          rawStatusDetail: payment.status_detail ?? null,
          approvedAt:
            status === PaymentAttemptStatus.APPROVED
              ? attempt.approvedAt ??
                (payment.date_approved ? new Date(payment.date_approved) : new Date())
              : attempt.approvedAt,
          lastCheckedAt: new Date()
        }
      });
      return;
    } catch {
      // The payment may belong to another Mercado Pago account.
    }
  }
}

function extractPaymentId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = "data" in payload ? payload.data : null;
  if (data && typeof data === "object" && "id" in data) {
    return data.id ? String(data.id) : null;
  }

  if ("id" in payload) {
    return payload.id ? String(payload.id) : null;
  }

  return null;
}

function mapPaymentStatus(payment: MercadoPagoPaymentSearchResult) {
  const status = String(payment.status ?? "").toLowerCase();
  const detail = String(payment.status_detail ?? "").toLowerCase();

  if (status === "approved" || detail === "accredited") {
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

  return PaymentAttemptStatus.PENDING;
}
