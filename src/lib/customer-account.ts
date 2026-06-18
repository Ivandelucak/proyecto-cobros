import { CustomerAccountMovementType, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export async function getCustomerBalance(customerId: string, client: PrismaLike = prisma) {
  const movements = await client.customerAccountMovement.findMany({
    where: { customerId },
    select: { type: true, amount: true }
  });

  return movements.reduce(
    (balance, movement) => balance.plus(signedAmount(movement.type, movement.amount)),
    new Prisma.Decimal(0)
  );
}

export async function getCustomerBalanceMap(customerIds: string[], client: PrismaLike = prisma) {
  if (customerIds.length === 0) {
    return new Map<string, Prisma.Decimal>();
  }

  const movements = await client.customerAccountMovement.findMany({
    where: { customerId: { in: [...new Set(customerIds)] } },
    select: { customerId: true, type: true, amount: true }
  });

  const balances = new Map<string, Prisma.Decimal>();
  for (const customerId of customerIds) {
    balances.set(customerId, new Prisma.Decimal(0));
  }

  for (const movement of movements) {
    balances.set(
      movement.customerId,
      (balances.get(movement.customerId) ?? new Prisma.Decimal(0)).plus(
        signedAmount(movement.type, movement.amount)
      )
    );
  }

  return balances;
}

export async function createCustomerAccountMovement(
  client: Prisma.TransactionClient,
  input: {
    customerId: string;
    saleId?: string | null;
    type: CustomerAccountMovementType;
    amount: Prisma.Decimal.Value;
    reason: string;
    paymentMethod?: PaymentMethod | null;
    userId: string;
  }
) {
  const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
  if (amount.equals(0)) {
    throw new Error("El movimiento no puede ser cero.");
  }

  const previousBalance = await getCustomerBalance(input.customerId, client);
  const newBalance = previousBalance
    .plus(signedAmount(input.type, amount))
    .toDecimalPlaces(2);

  return client.customerAccountMovement.create({
    data: {
      customerId: input.customerId,
      saleId: input.saleId ?? null,
      type: input.type,
      amount,
      previousBalance: previousBalance.toDecimalPlaces(2),
      newBalance,
      reason: input.reason,
      paymentMethod: input.paymentMethod ?? null,
      userId: input.userId
    }
  });
}

function signedAmount(type: CustomerAccountMovementType, amount: Prisma.Decimal) {
  if (
    type === CustomerAccountMovementType.PAYMENT ||
    type === CustomerAccountMovementType.SALE_CANCELLED
  ) {
    return amount.negated();
  }

  return amount;
}
