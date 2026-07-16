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
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
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

  const cashSetting = await getCashRegisterSetting(user.businessId ?? undefined);
  const allowedRoles = cashSetting.allowCashierCancelSale
    ? [Role.OWNER, Role.ADMIN, Role.CASHIER]
    : [Role.OWNER, Role.ADMIN];
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

    const fiscalSetting = await getFiscalSettingOrDefault(user.businessId ?? undefined, tx);
    const allowCancel = fiscalSetting.allowCancelBeforeIssue;

    if (
      sale.fiscalStatus !== FiscalStatus.NOT_REQUESTED &&
      sale.fiscalStatus !== FiscalStatus.FAILED &&
      sale.fiscalStatus !== FiscalStatus.CANCELLED_BEFORE_ISSUE &&
      sale.fiscalStatus !== FiscalStatus.CANCELLED_BY_CREDIT_NOTE
    ) {
      if (!allowCancel || sale.fiscalStatus === FiscalStatus.READY_TO_ISSUE) {
        throw new Error(
          "No se puede anular la venta porque tiene una factura electronica emitida o en proceso."
        );
      }
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancellationReason: input.reason.trim() || null
      }
    });

    for (const item of sale.items) {
      if (item.isManual || !item.productId) {
        continue;
      }
      const product = await tx.product.findFirst({
        where: { id: item.productId, deletedAt: null },
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
          businessId: user.businessId!,
          productId: product.id,
          type: StockMovementType.MANUAL_ADJUSTMENT,
          quantity: new Prisma.Decimal(item.quantity),
          previousStock,
          newStock,
          reason: `Anulacion venta #${formatInternalSaleNumber(sale)}`,
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
        reason: `Anulacion venta #${formatInternalSaleNumber(sale)}`,
        paymentMethod: PaymentMethod.CURRENT_ACCOUNT,
        userId: user.id
      });
    }

    await cancelFiscalBeforeIssueTx(tx, sale.id, user.id, reason);

    return { status: "cancelled", saleId: sale.id };
  });
}
