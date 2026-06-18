"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type PriceAdjustmentState = {
  error?: string;
  success?: string;
  preview?: Array<{
    id: string;
    name: string;
    currentPrice: string;
    newPrice: string;
    difference: string;
  }>;
  payload?: string;
};

type PricePayload = {
  categoryId: string;
  activeOnly: boolean;
  quickAccess: string;
  stock: string;
  percent: string;
  direction: "increase" | "decrease";
  rounding: "none" | "10" | "50" | "100";
};

export async function previewPriceAdjustmentAction(
  _state: PriceAdjustmentState,
  formData: FormData
): Promise<PriceAdjustmentState> {
  await requireAdminPage();

  try {
    const payload = readPayload(formData);
    const preview = await buildPreview(payload);
    if (preview.length === 0) {
      throw new Error("No hay productos para ajustar.");
    }

    return { preview, payload: JSON.stringify(payload) };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function confirmPriceAdjustmentAction(
  _state: PriceAdjustmentState,
  formData: FormData
): Promise<PriceAdjustmentState> {
  const user = await requireAdminPage();

  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "{}")) as PricePayload;
    const preview = await buildPreview(payload);
    if (preview.length === 0) {
      throw new Error("No hay productos para ajustar.");
    }

    await prisma.$transaction(
      preview.map((item) =>
        prisma.product.update({
          where: { id: item.id },
          data: { salePrice: new Prisma.Decimal(item.newPrice) }
        })
      )
    );

    revalidatePath("/productos");
    revalidatePath("/productos/ajuste-precios");
    revalidatePath("/caja");
    await createAuditLog({
      userId: user.id,
      action: "BULK_PRICE_UPDATE",
      entity: "Product",
      description: "Aplico ajuste masivo de precios.",
      metadata: {
        count: preview.length,
        payload
      }
    });
    return { success: `Se actualizaron ${preview.length} productos.` };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

async function buildPreview(payload: PricePayload) {
  const percent = parseLocalizedDecimal(payload.percent);
  if (percent.lte(0)) {
    throw new Error("El porcentaje debe ser mayor a cero.");
  }

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      ...(payload.activeOnly ? { active: true } : {}),
      ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
      ...(payload.quickAccess === "yes" ? { quickAccess: true } : {}),
      ...(payload.quickAccess === "no" ? { quickAccess: false } : {})
    },
    orderBy: { name: "asc" }
  });

  return products
    .filter((product) => {
      if (payload.stock === "with") {
        return product.stock.gt(0);
      }
      if (payload.stock === "without") {
        return product.stock.lte(0);
      }
      return true;
    })
    .map((product) => {
      const factor =
        payload.direction === "increase"
          ? new Prisma.Decimal(1).plus(percent.div(100))
          : new Prisma.Decimal(1).minus(percent.div(100));
      const calculated = product.salePrice.mul(factor);
      if (calculated.lt(0)) {
        throw new Error("El ajuste genera precios negativos.");
      }
      const newPrice = applyRounding(calculated, payload.rounding).toDecimalPlaces(2);
      return {
        id: product.id,
        name: product.name,
        currentPrice: product.salePrice.toString(),
        newPrice: newPrice.toString(),
        difference: newPrice.minus(product.salePrice).toString()
      };
    });
}

function applyRounding(value: Prisma.Decimal, rounding: PricePayload["rounding"]) {
  if (rounding === "none") {
    return value;
  }

  const step = new Prisma.Decimal(rounding);
  return new Prisma.Decimal(Math.round(value.div(step).toNumber())).mul(step);
}

function readPayload(formData: FormData): PricePayload {
  return {
    categoryId: String(formData.get("categoryId") ?? ""),
    activeOnly: formData.get("activeOnly") === "on",
    quickAccess: String(formData.get("quickAccess") ?? "all"),
    stock: String(formData.get("stock") ?? "all"),
    percent: String(formData.get("percent") ?? ""),
    direction: String(formData.get("direction") ?? "increase") as PricePayload["direction"],
    rounding: String(formData.get("rounding") ?? "none") as PricePayload["rounding"]
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo ajustar precios.";
}
