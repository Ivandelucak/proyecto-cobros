"use server";

import { Prisma, Role, StockMovementType, type UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { shouldUseDecimalQuantity } from "@/lib/stock-format";

export type MobileProductMutationResult =
  | { ok: true; changed: boolean; message: string; stock?: string; salePrice?: string; cost?: string | null }
  | { ok: false; error: string };

export async function adjustMobileProductStockAction(input: {
  productId: string;
  stock: string;
  reason?: string;
}): Promise<MobileProductMutationResult> {
  const user = await requireMobileProductManager();

  try {
    const newStock = parseLocalizedDecimal(input.stock).toDecimalPlaces(3);
    const reason = normalizeReason(input.reason);
    if (newStock.lt(0)) {
      return { ok: false, error: "El stock no puede ser negativo." };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM Product WHERE id = ${input.productId} AND businessId = ${user.businessId!} FOR UPDATE`
      );
      const product = await tx.product.findFirst({
        where: { id: input.productId, businessId: user.businessId!, deletedAt: null },
        select: {
          id: true,
          name: true,
          stock: true,
          allowsDecimalQuantity: true,
          unitType: true
        }
      });

      if (!product) {
        throw new Error("El producto no existe o no pertenece a este comercio.");
      }
      if (!allowsDecimalStock(product) && !newStock.equals(newStock.toDecimalPlaces(0))) {
        throw new Error("Este producto solo admite unidades enteras.");
      }
      if (product.stock.equals(newStock)) {
        return { changed: false, product };
      }

      await tx.product.update({ where: { id: product.id }, data: { stock: newStock } });
      await tx.stockMovement.create({
        data: {
          businessId: user.businessId!,
          productId: product.id,
          type: StockMovementType.MANUAL_ADJUSTMENT,
          quantity: newStock.minus(product.stock),
          previousStock: product.stock,
          newStock,
          reason: reason || "Ajuste de stock desde mobile",
          userId: user.id
        }
      });

      return { changed: true, product };
    });

    if (!result.changed) {
      return { ok: true, changed: false, message: "El stock ya tiene ese valor.", stock: result.product.stock.toString() };
    }

    await createAuditLog({
      businessId: user.businessId,
      userId: user.id,
      action: "UPDATE_STOCK",
      entity: "Product",
      entityId: result.product.id,
      description: `Ajusto el stock de ${result.product.name} desde mobile.`
    });
    revalidateMobileProductPaths();

    return { ok: true, changed: true, message: "Stock actualizado.", stock: newStock.toString() };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "No se pudo actualizar el stock.") };
  }
}

export async function updateMobileProductPricingAction(input: {
  productId: string;
  salePrice: string;
  cost: string;
}): Promise<MobileProductMutationResult> {
  const user = await requireMobileProductManager();

  try {
    const salePrice = parseMoney(input.salePrice, "El precio de venta");
    const cost = input.cost.trim() ? parseMoney(input.cost, "El costo") : null;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: input.productId, businessId: user.businessId!, deletedAt: null },
        select: { id: true, name: true, salePrice: true, cost: true }
      });
      if (!product) {
        throw new Error("El producto no existe o no pertenece a este comercio.");
      }

      const changed = !product.salePrice.equals(salePrice) || !sameOptionalDecimal(product.cost, cost);
      if (!changed) {
        return { changed: false, product };
      }

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { salePrice, cost },
        select: { salePrice: true, cost: true }
      });
      return { changed: true, product, updated };
    });

    if (!result.changed) {
      return {
        ok: true,
        changed: false,
        message: "El precio y el costo ya tienen esos valores.",
        salePrice: result.product.salePrice.toString(),
        cost: result.product.cost?.toString() ?? null
      };
    }

    if (!result.updated) {
      return { ok: false, error: "No se pudo confirmar la actualizacion del producto." };
    }

    await createAuditLog({
      businessId: user.businessId,
      userId: user.id,
      action: "UPDATE_PRICING",
      entity: "Product",
      entityId: result.product.id,
      description: `Actualizo precio y costo de ${result.product.name} desde mobile.`
    });
    revalidateMobileProductPaths();

    return {
      ok: true,
      changed: true,
      message: "Precio y costo actualizados.",
      salePrice: result.updated.salePrice.toString(),
      cost: result.updated.cost?.toString() ?? null
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "No se pudo actualizar el producto.") };
  }
}

async function requireMobileProductManager() {
  const user = await getCurrentUser();
  if (!user?.businessId) {
    throw new Error("Inicia sesion para actualizar productos.");
  }
  if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
    throw new Error("No tenes permiso para modificar productos desde mobile.");
  }
  return user;
}

function parseMoney(value: string, label: string) {
  const amount = parseLocalizedDecimal(value).toDecimalPlaces(2);
  if (amount.lt(0)) {
    throw new Error(`${label} debe ser mayor o igual a 0.`);
  }
  return amount;
}

function allowsDecimalStock(product: {
  allowsDecimalQuantity: boolean;
  unitType: UnitType;
}) {
  return product.allowsDecimalQuantity || shouldUseDecimalQuantity(product.unitType);
}

function sameOptionalDecimal(left: Prisma.Decimal | null, right: Prisma.Decimal | null) {
  return left === null || right === null ? left === right : left.equals(right);
}

function normalizeReason(value: string | undefined) {
  return (value ?? "").trim().slice(0, 240);
}

function revalidateMobileProductPaths() {
  revalidatePath("/m");
  revalidatePath("/m/stock");
  revalidatePath("/m/productos");
  revalidatePath("/stock");
  revalidatePath("/productos");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
