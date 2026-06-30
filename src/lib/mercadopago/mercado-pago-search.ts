import { PaymentAttemptOrigin, PaymentAttemptStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mercadoPagoRequest } from "./mercado-pago-client";
import { getMercadoPagoAccountWithToken } from "./mercado-pago-accounts";
import {
  isMercadoPagoAmountMatch,
  isMercadoPagoApprovedStatus
} from "./mercado-pago-match";
import type {
  MercadoPagoMovementView,
  MercadoPagoPaymentSearchResult
} from "./mercado-pago-types";

export async function searchRecentMercadoPagoPayments(input: {
  accountId: string;
  minutes?: number;
  limit?: number;
  status?: string;
  amount?: Prisma.Decimal.Value;
  tolerance?: Prisma.Decimal.Value;
  excludeAlreadyLinked?: boolean;
}) {
  const account = await getMercadoPagoAccountWithToken(input.accountId);
  if (!account) {
    throw new Error("La cuenta de Mercado Pago no esta disponible.");
  }

  const minutes = clampInt(input.minutes ?? 30, 1, 1440);
  const limit = clampInt(input.limit ?? 20, 1, 50);
  const endDate = new Date();
  const beginDate = new Date(endDate.getTime() - minutes * 60 * 1000);
  const data = await mercadoPagoRequest<{
    results?: MercadoPagoPaymentSearchResult[];
  }>({
    accessToken: account.accessToken,
    path: "/v1/payments/search",
    query: {
      status: input.status ?? "approved",
      range: "date_created",
      begin_date: beginDate.toISOString(),
      end_date: endDate.toISOString(),
      sort: "date_created",
      criteria: "desc",
      limit,
      offset: 0
    }
  });

  const rawPayments = data.results ?? [];
  const usedPaymentIds =
    input.excludeAlreadyLinked === false
      ? new Set<string>()
      : await getUsedProviderPaymentIds(
          account.id,
          rawPayments.map((payment) => String(payment.id ?? "")).filter(Boolean)
        );

  const movements = rawPayments.map((payment) =>
    mapPaymentToMovement(payment, usedPaymentIds.has(String(payment.id ?? "")))
  );

  if (input.amount === undefined) {
    return movements;
  }

  const tolerance = input.tolerance ?? new Prisma.Decimal(0);
  return movements.filter((movement) =>
    isMercadoPagoAmountMatch({
      amount: movement.amount,
      targetAmount: input.amount ?? 0,
      tolerance
    })
  );
}

export async function findAmountMatchingCandidates(input: {
  accountId: string;
  amount: Prisma.Decimal.Value;
}) {
  const account = await getMercadoPagoAccountWithToken(input.accountId);
  if (!account) {
    throw new Error("La cuenta de Mercado Pago no esta disponible.");
  }

  if (!account.enableAmountMatching) {
    throw new Error("El match por monto no esta habilitado para esta cuenta.");
  }

  const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  const tolerance = account.amountMatchingTolerance.toDecimalPlaces(2);
  const movements = await searchRecentMercadoPagoPayments({
    accountId: account.id,
    minutes: account.amountMatchingWindowMinutes,
    limit: 50,
    amount,
    tolerance
  });

  return movements.filter((movement) => {
    return (
      !movement.alreadyUsed &&
      isMercadoPagoApprovedStatus(movement.status) &&
      isMercadoPagoAmountMatch({
        amount: movement.amount,
        targetAmount: amount,
        tolerance
      })
    );
  });
}

export async function associateMercadoPagoPaymentByAmount(input: {
  accountId: string;
  paymentId: string;
  amount: Prisma.Decimal.Value;
  userId: string;
}) {
  const candidates = await findAmountMatchingCandidates({
    accountId: input.accountId,
    amount: input.amount
  });
  const candidate = candidates.find((movement) => movement.id === input.paymentId);

  if (!candidate) {
    throw new Error("El pago seleccionado no coincide con la busqueda configurada.");
  }
  if (candidate.alreadyUsed) {
    throw new Error("Ese pago Mercado Pago ya fue usado en otra venta.");
  }
  if (!isMercadoPagoApprovedStatus(candidate.status)) {
    throw new Error("Solo se pueden asociar cobros aprobados.");
  }

  const account = await getMercadoPagoAccountWithToken(input.accountId);
  if (!account) {
    throw new Error("La cuenta de Mercado Pago no esta disponible.");
  }

  const usedAttempt = await prisma.paymentAttempt.findFirst({
    where: {
      mercadoPagoAccountId: account.id,
      providerPaymentId: candidate.id,
      payment: { isNot: null }
    },
    select: { id: true }
  });

  if (usedAttempt) {
    throw new Error("Ese pago Mercado Pago ya fue usado en otra venta.");
  }

  const existingAttempt = await prisma.paymentAttempt.findFirst({
    where: {
      mercadoPagoAccountId: account.id,
      providerPaymentId: candidate.id
    },
    include: { mercadoPagoAccount: true }
  });

  const data = {
    mercadoPagoAccountId: account.id,
    providerPaymentId: candidate.id,
    amount: new Prisma.Decimal(candidate.amount).toDecimalPlaces(2),
    status: PaymentAttemptStatus.APPROVED,
    origin: PaymentAttemptOrigin.AMOUNT_MATCH,
    rawStatus: candidate.status,
    rawStatusDetail: candidate.statusDetail,
    approvedAt: candidate.dateApproved ? new Date(candidate.dateApproved) : new Date(),
    associatedByUserId: input.userId,
    lastCheckedAt: new Date()
  };

  if (existingAttempt) {
    return prisma.paymentAttempt.update({
      where: { id: existingAttempt.id },
      data,
      include: { mercadoPagoAccount: true }
    });
  }

  const externalReference = createMatchedExternalReference(candidate.id);

  return prisma.paymentAttempt.create({
    data: {
      ...data,
      externalReference
    },
    include: { mercadoPagoAccount: true }
  });
}

async function getUsedProviderPaymentIds(accountId: string, ids: string[]) {
  if (ids.length === 0) {
    return new Set<string>();
  }

  const attempts = await prisma.paymentAttempt.findMany({
    where: {
      mercadoPagoAccountId: accountId,
      providerPaymentId: { in: ids },
      payment: { isNot: null }
    },
    select: { providerPaymentId: true }
  });

  return new Set(attempts.map((attempt) => attempt.providerPaymentId).filter(Boolean));
}

function mapPaymentToMovement(
  payment: MercadoPagoPaymentSearchResult,
  alreadyUsed: boolean
): MercadoPagoMovementView {
  const payerLabel = [
    payment.payer?.first_name,
    payment.payer?.last_name,
    payment.payer?.email
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: String(payment.id ?? ""),
    amount: String(payment.transaction_amount ?? payment.total_paid_amount ?? 0),
    status: payment.status ?? "-",
    statusDetail: payment.status_detail ?? null,
    dateApproved: payment.date_approved ?? null,
    dateCreated: payment.date_created ?? null,
    externalReference: payment.external_reference ?? null,
    description: payment.description ?? null,
    payerLabel: payerLabel || null,
    paymentMethod: payment.payment_method_id ?? null,
    paymentType: payment.payment_type_id ?? null,
    operationType: payment.operation_type ?? null,
    rawSummary: {
      id: payment.id ?? null,
      status: payment.status ?? null,
      status_detail: payment.status_detail ?? null,
      payment_method_id: payment.payment_method_id ?? null,
      payment_type_id: payment.payment_type_id ?? null,
      operation_type: payment.operation_type ?? null,
      external_reference: payment.external_reference ?? null,
      date_created: payment.date_created ?? null,
      date_approved: payment.date_approved ?? null
    },
    alreadyUsed
  };
}

function createMatchedExternalReference(paymentId: string) {
  return `MPPAY_${paymentId.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 64);
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
