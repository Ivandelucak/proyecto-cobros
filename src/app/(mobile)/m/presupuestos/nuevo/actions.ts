"use server";

import { Prisma, QuoteStatus, UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMobileAuth } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

export type MobileQuoteFormState = {
  error?: string;
};

type MobileQuoteItemInput = {
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitType: UnitType;
};

export async function createMobileQuoteAction(
  _state: MobileQuoteFormState,
  formData: FormData
): Promise<MobileQuoteFormState> {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  let redirectTarget = "";

  try {
    const customerName = String(formData.get("customerName") ?? "").trim();
    const customerDocument = String(formData.get("customerDocument") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!customerName) {
      throw new Error("El nombre del cliente es obligatorio.");
    }

    const itemsJson = String(formData.get("itemsJson") ?? "[]");
    const itemsRaw = JSON.parse(itemsJson) as MobileQuoteItemInput[];

    if (itemsRaw.length === 0) {
      throw new Error("Agrega al menos un producto al presupuesto.");
    }

    const items = itemsRaw.map((item) => {
      const qty = new Prisma.Decimal(item.quantity);
      const price = new Prisma.Decimal(item.unitPrice);
      if (qty.lte(0)) {
        throw new Error(`La cantidad de "${item.productName}" debe ser mayor a cero.`);
      }
      if (price.lt(0)) {
        throw new Error(`El precio de "${item.productName}" no puede ser negativo.`);
      }

      return {
        productId: item.productId || null,
        productNameSnapshot: item.productName.trim(),
        quantity: qty,
        unitPrice: price,
        subtotal: qty.mul(price).toDecimalPlaces(2),
        unitTypeSnapshot: item.unitType || UnitType.UNIT
      };
    });

    const subtotal = items.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
    const total = subtotal; // Mobile does not force discount/surcharges in this simple view

    const quote = await prisma.quote.create({
      data: {
        businessId,
        customerNameSnapshot: customerName,
        customerDocumentSnapshot: customerDocument || null,
        status: QuoteStatus.DRAFT,
        subtotal,
        discountTotal: new Prisma.Decimal(0),
        surchargeTotal: new Prisma.Decimal(0),
        total,
        notes: notes || null,
        createdById: user.id,
        items: {
          create: items
        }
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Quote",
      entityId: quote.id,
      description: `Creo presupuesto mobile #${quote.quoteNumber} para ${quote.customerNameSnapshot}.`,
      metadata: { total: quote.total.toString(), origin: "MOBILE" }
    });

    revalidatePath("/m/presupuestos");
    redirectTarget = "/m/presupuestos";
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Error al guardar el presupuesto." };
  }

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  return {};
}
