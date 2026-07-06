import { Prisma, Role, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/permissions";

type AdjustStockInput = {
  userId: string;
  productId: string;
  newStock: Prisma.Decimal.Value;
  reason?: string;
};

export async function adjustStock(input: AdjustStockInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.active) {
    throw new Error("Usuario invalido.");
  }

  assertRole(user.role, [Role.OWNER, Role.ADMIN], "ajustar stock");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: input.productId,
        active: true,
        deletedAt: null
      }
    });

    if (!product) {
      throw new Error("Producto no encontrado.");
    }

    const newStock = new Prisma.Decimal(input.newStock);
    if (newStock.lt(0)) {
      throw new Error("El stock no puede ser negativo.");
    }

    const previousStock = product.stock;
    const quantity = newStock.minus(previousStock);

    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: { stock: newStock }
    });

    await tx.stockMovement.create({
      data: {
        businessId: user.businessId!,
        productId: product.id,
        type: StockMovementType.MANUAL_ADJUSTMENT,
        quantity,
        previousStock,
        newStock,
        reason: input.reason,
        userId: user.id
      }
    });

    return updatedProduct;
  });
}
