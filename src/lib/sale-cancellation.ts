import {
  CustomerAccountMovementType,
  FiscalDocumentStatus,
  FiscalStatus,
  PaymentMethod,
  Prisma,
  Role,
  SaleStatus,
  StockMovementType
} from "@prisma/client";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { createCustomerAccountMovement } from "@/lib/customer-account";
import {
  cancelFiscalBeforeIssueTx,
  markCreditNoteRequiredTx
} from "@/lib/fiscal/fiscal-engine";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/permissions";

type CancelSaleResult =
  | { status: "cancelled"; saleId: string }
  | { status: "credit_note_required"; saleId: string };

export async function cancelSale(input: {
  saleId: string;
  userId: string;
  reason: string;
}): Promise<CancelSaleResult> {
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
        payments: true,
        fiscalDocument: {
          select: { status: true }
        }
      }
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("La venta ya esta anulada.");
    }

    if (
      sale.fiscalStatus === FiscalStatus.ISSUED ||
      sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED ||
      sale.fiscalDocument?.status === FiscalDocumentStatus.ISSUED
    ) {
      await markCreditNoteRequiredTx(tx, sale.id, user.id, reason);
      return { status: "credit_note_required", saleId: sale.id };
    }

    const fiscalSetting = await getFiscalSettingOrDefault(tx);
    if (sale.requiresFiscalInvoice && !fiscalSetting.allowCancelBeforeIssue) {
      throw new Error("La configuracion fiscal no permite anular antes de emitir.");
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

    await cancelFiscalBeforeIssueTx(tx, sale.id, user.id, reason);

    return { status: "cancelled", saleId: sale.id };
  });
}
