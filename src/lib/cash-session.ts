import {
  CashMovementType,
  CashSessionStatus,
  PaymentMethod,
  Prisma,
  SaleStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CashSessionSummary = {
  cashSales: string;
  manualIncome: string;
  manualExpense: string;
  cashWithdrawals: string;
  cashAdjustments: string;
  expectedCash: string;
};

export async function getOpenCashSessionSnapshot(businessId: string) {
  const session = await prisma.cashSession.findFirst({
    where: { status: CashSessionStatus.OPEN, businessId },
    include: {
      openedBy: {
        select: { name: true, email: true }
      },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 8
      }
    },
    orderBy: { openedAt: "desc" }
  });

  if (!session) {
    return null;
  }

  const summary = await calculateCashSessionSummary(session.id);

  return {
    id: session.id,
    openedAt: session.openedAt,
    openingAmount: session.openingAmount.toString(),
    notes: session.notes,
    openedByName: session.openedBy.name,
    summary,
    movements: session.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: movement.amount.toString(),
      reason: movement.reason,
      createdAt: movement.createdAt
    }))
  };
}

export async function calculateCashSessionSummary(cashSessionId: string) {
  const [cashPayments, movements] = await Promise.all([
    prisma.payment.findMany({
      where: {
        method: PaymentMethod.CASH,
        sale: {
          cashSessionId,
          status: SaleStatus.PAID
        }
      },
      select: { amount: true }
    }),
    prisma.cashMovement.findMany({
      where: { cashSessionId },
      select: {
        type: true,
        amount: true
      }
    })
  ]);

  const cashSales = sumDecimals(cashPayments.map((payment) => payment.amount));
  const manualIncome = sumMovementType(movements, CashMovementType.INCOME);
  const manualExpense = sumMovementType(movements, CashMovementType.EXPENSE);
  const cashWithdrawals = sumMovementType(movements, CashMovementType.CASH_WITHDRAWAL);
  const cashAdjustments = sumMovementType(movements, CashMovementType.CASH_ADJUSTMENT);
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: cashSessionId },
    select: { openingAmount: true }
  });
  const expectedCash = session.openingAmount
    .plus(cashSales)
    .plus(manualIncome)
    .minus(manualExpense)
    .minus(cashWithdrawals)
    .plus(cashAdjustments)
    .toDecimalPlaces(2);

  return {
    cashSales: cashSales.toString(),
    manualIncome: manualIncome.toString(),
    manualExpense: manualExpense.toString(),
    cashWithdrawals: cashWithdrawals.toString(),
    cashAdjustments: cashAdjustments.toString(),
    expectedCash: expectedCash.toString()
  };
}

function sumMovementType(
  movements: Array<{ type: CashMovementType; amount: Prisma.Decimal }>,
  type: CashMovementType
) {
  return sumDecimals(
    movements.filter((movement) => movement.type === type).map((movement) => movement.amount)
  );
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
}
