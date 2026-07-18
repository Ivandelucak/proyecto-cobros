"use server";

import { Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  applyPriceRounding,
  calculatePercentagePrice,
  formatEditableMoney,
  parseEditableDecimal,
  type PriceAdjustmentDirection,
  type PriceRounding
} from "@/lib/product-price-adjustment";
import { prisma } from "@/lib/prisma";

type TextSearchScope = "name" | "brand" | "name_or_brand";

export type PriceAdjustmentPreviewItem = {
  id: string;
  name: string;
  brand: string | null;
  categoryName: string;
  currentPrice: string;
  newPrice: string;
  difference: string;
};

export type PriceAdjustmentState = {
  error?: string;
  success?: string;
  preview?: PriceAdjustmentPreviewItem[];
  payload?: string;
  proof?: string;
  adjustment?: {
    percent: string;
    direction: PriceAdjustmentDirection;
    rounding: PriceRounding;
    totalDifference: string;
  };
  result?: {
    updated: number;
    conflicts: number;
    skipped: number;
  };
};

type PricePayload = {
  categoryId: string;
  brand: string;
  brandMatch: "exact" | "contains";
  search: string;
  textQuery: string;
  textSearchScope: TextSearchScope;
  activeOnly: boolean;
  quickAccess: "all" | "yes" | "no";
  stock: "all" | "with" | "without";
  percent: string;
  direction: PriceAdjustmentDirection;
  rounding: PriceRounding;
};

type PriceAdjustmentSelection = {
  id: string;
  expectedPrice: string;
};

export async function previewPriceAdjustmentAction(
  _state: PriceAdjustmentState,
  formData: FormData
): Promise<PriceAdjustmentState> {
  const user = await requireAdminPage();

  try {
    const payload = readPayload(formData);
    const preview = await buildPreview(payload, user.businessId!);
    if (preview.length === 0) {
      throw new Error("No hay productos para ajustar con los filtros seleccionados.");
    }

    return {
      preview,
      payload: JSON.stringify(payload),
      proof: signPreview(user.id, user.businessId!, payload, preview),
      adjustment: summarizeAdjustment(preview, payload)
    };
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
    const payload = readPayloadJson(formData.get("payload"));
    const selections = readSelections(formData.get("selections"));
    const snapshot = readPreviewSnapshot(formData.get("snapshot"));
    const proof = readText(formData.get("proof"), 256);
    if (!isPreviewProofValid(proof, user.id, user.businessId!, payload, snapshot)) {
      throw new Error("La previsualizacion no es valida o vencio. Genera una nueva antes de aplicar.");
    }
    if (selections.length === 0) {
      throw new Error("Selecciona al menos un producto de la previsualizacion.");
    }

    const currentPreview = await buildPreview(payload, user.businessId!);
    const currentById = new Map(currentPreview.map((item) => [item.id, item]));
    const snapshotById = new Map(snapshot.map((item) => [item.id, item]));
    const pendingUpdates: PriceAdjustmentPreviewItem[] = [];
    let conflicts = 0;
    let skipped = 0;

    for (const selection of selections) {
      const snapshotItem = snapshotById.get(selection.id);
      if (!snapshotItem || snapshotItem.currentPrice !== selection.expectedPrice) {
        skipped += 1;
        continue;
      }

      const item = currentById.get(selection.id);
      if (!item) {
        skipped += 1;
        continue;
      }

      if (item.currentPrice !== selection.expectedPrice) {
        conflicts += 1;
        continue;
      }

      pendingUpdates.push(item);
    }

    if (pendingUpdates.length === 0) {
      const message = buildResultMessage(0, conflicts, skipped);
      return { success: message, result: { updated: 0, conflicts, skipped } };
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      let updated = 0;
      let concurrentConflicts = 0;
      const updatedItems: PriceAdjustmentPreviewItem[] = [];

      for (const item of pendingUpdates) {
        const result = await tx.product.updateMany({
          where: {
            id: item.id,
            businessId: user.businessId!,
            deletedAt: null,
            salePrice: new Prisma.Decimal(item.currentPrice)
          },
          data: { salePrice: new Prisma.Decimal(item.newPrice) }
        });

        if (result.count === 1) {
          updated += 1;
          updatedItems.push(item);
        } else {
          concurrentConflicts += 1;
        }
      }

      return { updated, concurrentConflicts, updatedItems };
    });

    conflicts += transactionResult.concurrentConflicts;
    const updatedItems = transactionResult.updatedItems;

    await Promise.all([
      ...updatedItems.map((item) =>
        createAuditLog({
          businessId: user.businessId,
          userId: user.id,
          action: "BULK_PRICE_UPDATE",
          entity: "Product",
          entityId: item.id,
          description: `Actualizo el precio de ${item.name} mediante ajuste masivo.`,
          metadata: {
            previousPrice: item.currentPrice,
            newPrice: item.newPrice,
            percentage: payload.percent,
            direction: payload.direction,
            rounding: payload.rounding,
            origin: "BULK_PRICE_ADJUSTMENT"
          }
        })
      ),
      createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        action: "BULK_PRICE_UPDATE",
        entity: "Product",
        description: "Aplico ajuste masivo de precios.",
        metadata: {
          updated: transactionResult.updated,
          conflicts,
          skipped,
          payload
        }
      })
    ]);

    revalidatePath("/productos");
    revalidatePath("/productos/ajuste-precios");
    revalidatePath("/caja");
    revalidatePath("/reportes");

    return {
      success: buildResultMessage(transactionResult.updated, conflicts, skipped),
      result: { updated: transactionResult.updated, conflicts, skipped }
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

async function buildPreview(payload: PricePayload, businessId: string) {
  const products = await prisma.product.findMany({
    where: buildProductWhere(payload, businessId),
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" }
  });

  return products.map((product) => {
    const newPrice = calculateAdjustedPrice(product.salePrice.toString(), payload);
    const decimalNewPrice = new Prisma.Decimal(newPrice);

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      categoryName: product.category.name,
      currentPrice: product.salePrice.toFixed(2),
      newPrice,
      difference: decimalNewPrice.minus(product.salePrice).toFixed(2)
    };
  });
}

function buildProductWhere(payload: PricePayload, businessId: string): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [];

  if (payload.brand) {
    conditions.push(
      payload.brandMatch === "contains"
        ? { brand: { contains: payload.brand } }
        : { brand: payload.brand }
    );
  }

  if (payload.search) {
    conditions.push({
      OR: [
        { name: { contains: payload.search } },
        { barcode: { contains: payload.search } },
        { sku: { contains: payload.search } },
        { brand: { contains: payload.search } }
      ]
    });
  }

  if (payload.textQuery) {
    // MySQL uses the database collation for contains; the production collation is case-insensitive.
    const textCondition = { contains: payload.textQuery };
    conditions.push(
      payload.textSearchScope === "name"
        ? { name: textCondition }
        : payload.textSearchScope === "brand"
          ? { brand: textCondition }
          : { OR: [{ name: textCondition }, { brand: textCondition }] }
    );
  }

  return {
    businessId,
    deletedAt: null,
    ...(payload.activeOnly ? { active: true } : {}),
    ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
    ...(payload.quickAccess === "yes" ? { quickAccess: true } : {}),
    ...(payload.quickAccess === "no" ? { quickAccess: false } : {}),
    ...(payload.stock === "with" ? { stock: { gt: 0 } } : {}),
    ...(payload.stock === "without" ? { stock: { lte: 0 } } : {}),
    ...(conditions.length > 0 ? { AND: conditions } : {})
  };
}

function calculateAdjustedPrice(currentPrice: string, payload: PricePayload) {
  const adjusted = calculatePercentagePrice(currentPrice, payload.percent, payload.direction);
  const rounded = adjusted === null ? null : applyPriceRounding(adjusted, payload.rounding);
  if (rounded === null) {
    throw new Error("No se pudo calcular un precio valido para el ajuste.");
  }

  return formatEditableMoney(rounded);
}

function summarizeAdjustment(preview: PriceAdjustmentPreviewItem[], payload: PricePayload) {
  const totalDifference = preview.reduce(
    (total, item) => total.plus(new Prisma.Decimal(item.difference)),
    new Prisma.Decimal(0)
  );

  return {
    percent: payload.percent,
    direction: payload.direction,
    rounding: payload.rounding,
    totalDifference: totalDifference.toFixed(2)
  };
}

function readPayload(formData: FormData): PricePayload {
  return parsePayload({
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand"),
    brandMatch: formData.get("brandMatch"),
    search: formData.get("search"),
    textQuery: formData.get("textQuery"),
    textSearchScope: formData.get("textSearchScope"),
    activeOnly: formData.get("activeOnly"),
    quickAccess: formData.get("quickAccess"),
    stock: formData.get("stock"),
    percent: formData.get("percent"),
    direction: formData.get("direction"),
    rounding: formData.get("rounding")
  });
}

function readPayloadJson(value: FormDataEntryValue | null): PricePayload {
  if (typeof value !== "string") {
    throw new Error("La previsualizacion no es valida. Genera una nueva antes de aplicar.");
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsePayload(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("La previsualizacion no es valida. Genera una nueva antes de aplicar.");
    }
    throw error;
  }
}

function readPreviewSnapshot(value: FormDataEntryValue | null): PriceAdjustmentPreviewItem[] {
  if (typeof value !== "string") {
    throw new Error("La previsualizacion no es valida. Genera una nueva antes de aplicar.");
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    const snapshot = parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
      .map((item) => ({
        id: readText(item.id, 191),
        name: readText(item.name, 255),
        brand: typeof item.brand === "string" ? readText(item.brand, 120) : null,
        categoryName: readText(item.categoryName, 255),
        currentPrice: readText(item.currentPrice, 32),
        newPrice: readText(item.newPrice, 32),
        difference: readText(item.difference, 32)
      }))
      .filter(
        (item) =>
          Boolean(item.id) &&
          parseEditableDecimal(item.currentPrice) !== null &&
          parseEditableDecimal(item.newPrice) !== null
      );

    return [...new Map(snapshot.map((item) => [item.id, item])).values()];
  } catch {
    throw new Error("La previsualizacion no es valida. Genera una nueva antes de aplicar.");
  }
}

function parsePayload(value: Record<string, unknown>): PricePayload {
  const parsedPercent = parseEditableDecimal(readText(value.percent, 32));
  if (parsedPercent === null || parsedPercent <= 0) {
    throw new Error("El porcentaje debe ser mayor a cero.");
  }

  const direction = value.direction === "decrease" ? "decrease" : "increase";
  if (direction === "decrease" && parsedPercent > 100) {
    throw new Error("La reduccion no puede superar el 100%.");
  }

  const rounding = ["10", "50", "100"].includes(String(value.rounding))
    ? (String(value.rounding) as PriceRounding)
    : "none";

  return {
    categoryId: readText(value.categoryId, 191),
    brand: readText(value.brand, 120),
    brandMatch: value.brandMatch === "contains" ? "contains" : "exact",
    search: readText(value.search, 120),
    textQuery: readText(value.textQuery, 120),
    textSearchScope:
      value.textSearchScope === "name" || value.textSearchScope === "brand"
        ? value.textSearchScope
        : "name_or_brand",
    activeOnly: value.activeOnly === "on" || value.activeOnly === true,
    quickAccess: value.quickAccess === "yes" || value.quickAccess === "no" ? value.quickAccess : "all",
    stock: value.stock === "with" || value.stock === "without" ? value.stock : "all",
    percent: String(parsedPercent),
    direction,
    rounding
  };
}

function readSelections(value: FormDataEntryValue | null): PriceAdjustmentSelection[] {
  if (typeof value !== "string") {
    throw new Error("La seleccion de productos no es valida.");
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    const selections = parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
      .map((item) => ({
        id: readText(item.id, 191),
        expectedPrice: readText(item.expectedPrice, 32)
      }))
      .filter((item) => Boolean(item.id) && parseEditableDecimal(item.expectedPrice) !== null);

    return [...new Map(selections.map((item) => [item.id, item])).values()];
  } catch {
    throw new Error("La seleccion de productos no es valida.");
  }
}

function buildResultMessage(updated: number, conflicts: number, skipped: number) {
  const parts = [`${updated} producto${updated === 1 ? "" : "s"} actualizado${updated === 1 ? "" : "s"}.`];
  if (conflicts > 0) {
    parts.push(`${conflicts} cambiaron desde la previsualizacion y no se actualizaron.`);
  }
  if (skipped > 0) {
    parts.push(`${skipped} ya no cumplen los filtros y se omitieron.`);
  }
  return parts.join(" ");
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function signPreview(
  userId: string,
  businessId: string,
  payload: PricePayload,
  preview: PriceAdjustmentPreviewItem[]
) {
  return createHmac("sha256", getPreviewSecret())
    .update(JSON.stringify({ userId, businessId, payload, preview }))
    .digest("base64url");
}

function isPreviewProofValid(
  proof: string,
  userId: string,
  businessId: string,
  payload: PricePayload,
  preview: PriceAdjustmentPreviewItem[]
) {
  if (!proof) {
    return false;
  }

  const expected = signPreview(userId, businessId, payload, preview);
  const receivedBuffer = Buffer.from(proof);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function getPreviewSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("No se puede validar la previsualizacion de precios en este entorno.");
  }
  return secret;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo ajustar precios.";
}
