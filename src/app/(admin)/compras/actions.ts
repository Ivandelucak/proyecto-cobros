"use server";

import { Prisma, PurchaseStatus, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type PurchaseFormState = {
  error?: string;
};

type PurchaseRow = {
  productId: string;
  quantity: string;
  unitCost: string;
};

export async function createPurchaseAction(
  _state: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  const user = await requireAdminPage();
  let purchaseId = "";

  try {
    const supplierId = readOptional(formData, "supplierId");
    const notes = readOptional(formData, "notes");
    const rows = parseRows(String(formData.get("rowsJson") ?? "[]"));

    if (rows.length === 0) {
      throw new Error("Agrega al menos un producto.");
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const productIds = [...new Set(rows.map((row) => row.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, deletedAt: null }
      });
      const productsById = new Map(products.map((product) => [product.id, product]));

      if (productsById.size !== productIds.length) {
        throw new Error("Uno o mas productos no existen.");
      }

      const items = rows.map((row) => {
        const product = productsById.get(row.productId);
        if (!product) {
          throw new Error("Producto invalido.");
        }

        const quantity = parseLocalizedDecimal(row.quantity).toDecimalPlaces(3);
        const unitCost = parseLocalizedDecimal(row.unitCost).toDecimalPlaces(2);
        if (quantity.lte(0) || unitCost.lt(0)) {
          throw new Error("Cantidad y costo deben ser validos.");
        }

        return {
          product,
          quantity,
          unitCost,
          subtotal: quantity.mul(unitCost).toDecimalPlaces(2)
        };
      });

      const total = items.reduce(
        (sum, item) => sum.plus(item.subtotal),
        new Prisma.Decimal(0)
      );

      const created = await tx.purchase.create({
        data: {
          businessId: user.businessId!,
          supplierId: supplierId || null,
          userId: user.id,
          total,
          notes,
          status: PurchaseStatus.RECEIVED,
          items: {
            create: items.map((item) => ({
              productId: item.product.id,
              productNameSnapshot: item.product.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              subtotal: item.subtotal
            }))
          }
        }
      });

      for (const item of items) {
        const previousStock = item.product.stock;
        const newStock = previousStock.plus(item.quantity);
        await tx.product.update({
          where: { id: item.product.id },
          data: {
            stock: newStock,
            cost: item.unitCost
          }
        });
        await tx.stockMovement.create({
          data: {
            businessId: user.businessId!,
            productId: item.product.id,
            type: StockMovementType.PURCHASE,
            quantity: item.quantity,
            previousStock,
            newStock,
            reason: `Compra #${created.purchaseNumber}`,
            referenceId: created.id,
            userId: user.id
          }
        });
      }

      return created;
    });

    revalidatePath("/compras");
    revalidatePath("/stock");
    revalidatePath("/productos");
    revalidatePath("/admin");
    purchaseId = purchase.id;
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Purchase",
      entityId: purchase.id,
      description: `Registro compra #${purchase.purchaseNumber}.`,
      metadata: { total: purchase.total.toString() }
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  redirect(`/compras/${purchaseId}`);
}

function parseRows(raw: string) {
  const parsed = JSON.parse(raw) as PurchaseRow[];
  return parsed.filter((row) => row.productId && row.quantity && row.unitCost);
}

function readOptional(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo registrar la compra.";
}
