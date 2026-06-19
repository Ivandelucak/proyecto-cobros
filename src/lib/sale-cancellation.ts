import {
  CustomerAccountMovementType,
  PaymentMethod,
  Prisma,
  Role,
  SaleStatus,
  StockMovementType
} from "@prisma/client";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { createCustomerAccountMovement } from "@/lib/customer-account";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/permissions";

export async function cancelSale(input: {
  saleId: string;
  userId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("El motivo es obligatorio.");
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.active) {
    throw new Error("Usuario invalido.");
  }

  const cashSetting = await getCashRegisterSetting();
  const allowedRoles = cashSetting.allowCashierCancelSale
    ? [Role.ADMIN, Role.CASHIER]
    : [Role.ADMIN];
  assertRole(user.role, allowedRoles, "anular ventas");

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("La venta ya esta anulada.");
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancellationReason: reason
      }
    });

    for (const item of sale.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          stock: true
        }
      });

      if (!product) {
        continue;
      }

      const previousStock = product.stock;
      const newStock = previousStock.plus(item.quantity);

      await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock }
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: StockMovementType.MANUAL_ADJUSTMENT,
          quantity: new Prisma.Decimal(item.quantity),
          previousStock,
          newStock,
          reason: `Anulacion venta #${sale.saleNumber}`,
          referenceId: sale.id,
          userId: user.id
        }
      });
    }

    const currentAccountAmount = sale.payments
      .filter((payment) => payment.method === PaymentMethod.CURRENT_ACCOUNT)
      .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0))
      .toDecimalPlaces(2);

    if (sale.customerId && currentAccountAmount.gt(0)) {
      await createCustomerAccountMovement(tx, {
        customerId: sale.customerId,
        saleId: sale.id,
        type: CustomerAccountMovementType.SALE_CANCELLED,
        amount: currentAccountAmount,
        reason: `Anulacion venta #${sale.saleNumber}`,
        paymentMethod: PaymentMethod.CURRENT_ACCOUNT,
        userId: user.id
      });
    }

    return sale.id;
  });
}
