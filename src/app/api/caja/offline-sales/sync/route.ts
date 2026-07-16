import { PaymentMethod, UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isSaleSurchargeType } from "@/lib/sale-surcharge";
import { confirmSale, OfflineSaleSyncError } from "@/lib/sale-engine";
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
import type {
  OfflineSaleSyncPayload,
  OfflineSaleSyncResponse
} from "@/lib/offline-sales/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.businessId) {
    return response({
      ok: false,
      code: "AUTH_REQUIRED",
      error: "Inicia sesion para sincronizar las ventas pendientes.",
      retryable: true
    }, 401);
  }

  try {
    const payload = parsePayload(await request.json());
    if (payload.businessId !== user.businessId || payload.userId !== user.id) {
      throw new OfflineSaleSyncError(
        "La venta offline no corresponde a la sesion actual.",
        "OFFLINE_CONTEXT_MISMATCH",
        false
      );
    }

    const existingSale = await prisma.sale.findFirst({
      where: {
        businessId: user.businessId,
        clientOperationId: payload.clientOperationId
      },
      select: { id: true, internalNumber: true, internalPeriod: true }
    });
    if (existingSale) {
      return response({
        ok: true,
        saleId: existingSale.id,
        internalSaleNumber: formatInternalSaleNumber(existingSale),
        alreadySynced: true,
        lateCashSession: false
      });
    }

    const sale = await confirmSale({
      userId: user.id,
      items: payload.items.map((item) => ({
        productId: item.productId,
        isManual: item.isManual,
        name: item.nameSnapshot,
        quantity: parseLocalizedDecimal(item.quantity),
        unitPrice: parseLocalizedDecimal(item.unitPriceSnapshot),
        unitTypeSnapshot: item.unitTypeSnapshot as UnitType,
        allowsDecimalQuantity: item.allowsDecimalQuantity
      })),
      payments: [
        {
          method: PaymentMethod.CASH,
          amount: parseLocalizedDecimal(payload.total),
          receivedAmount: parseLocalizedDecimal(payload.cashReceived)
        }
      ],
      surcharge: payload.surcharge
        ? {
            type: payload.surcharge.type,
            value: parseLocalizedDecimal(payload.surcharge.value)
          }
        : null,
      fiscalInvoiceRequested: false,
      offline: {
        clientOperationId: payload.clientOperationId,
        businessId: payload.businessId,
        userId: payload.userId,
        cashSessionId: payload.cashSessionId,
        occurredAt: new Date(payload.occurredAt)
      }
    });

    await createAuditLog({
      businessId: user.businessId,
      userId: user.id,
      action: sale.offlineSyncLate ? "OFFLINE_SALE_SYNCED_LATE" : "OFFLINE_SALE_SYNCED",
      entity: "Sale",
      entityId: sale.id,
      description: sale.offlineSyncLate
        ? `Sincronizo tardÃ­amente la venta offline #${formatInternalSaleNumber(sale)}.`
        : `Sincronizo la venta offline #${formatInternalSaleNumber(sale)}.`,
      metadata: {
        clientOperationId: payload.clientOperationId,
        cashSessionId: payload.cashSessionId,
        occurredAt: payload.occurredAt
      }
    });

    revalidatePath("/caja");
    revalidatePath("/productos");
    revalidatePath("/stock");
    revalidatePath("/ventas");
    revalidatePath("/reportes");
    revalidatePath("/facturacion");

    return response({
      ok: true,
      saleId: sale.id,
      internalSaleNumber: formatInternalSaleNumber(sale),
      alreadySynced: false,
      lateCashSession: sale.offlineSyncLate
    });
  } catch (error) {
    if (error instanceof OfflineSaleSyncError) {
      return response({
        ok: false,
        code: error.code,
        error: error.message,
        retryable: error.retryable
      }, error.retryable ? 409 : 400);
    }

    return response({
      ok: false,
      code: "OFFLINE_SYNC_INVALID",
      error: error instanceof Error ? error.message : "No se pudo sincronizar la venta offline.",
      retryable: true
    }, 400);
  }
}

function parsePayload(value: unknown): OfflineSaleSyncPayload {
  if (!value || typeof value !== "object") {
    throw new OfflineSaleSyncError("El contenido de la venta offline es invalido.", "OFFLINE_PAYLOAD_INVALID", false);
  }

  const payload = value as Record<string, unknown>;
  const clientOperationId = requiredText(payload.clientOperationId, "clientOperationId", 191);
  if (!/^[A-Za-z0-9_-]{8,191}$/.test(clientOperationId)) {
    throw new OfflineSaleSyncError("El identificador offline es invalido.", "OFFLINE_OPERATION_INVALID", false);
  }

  const occurredAt = requiredText(payload.occurredAt, "occurredAt", 64);
  const occurredAtDate = new Date(occurredAt);
  if (Number.isNaN(occurredAtDate.getTime()) || occurredAtDate.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new OfflineSaleSyncError("La fecha de la venta offline es invalida.", "OFFLINE_OCCURRED_AT_INVALID", false);
  }

  const total = parseMoney(payload.total, "total");
  const cashReceived = parseMoney(payload.cashReceived, "cashReceived");
  const changeAmount = parseMoney(payload.changeAmount, "changeAmount");
  if (
    total.lte(0) ||
    cashReceived.lt(total) ||
    !cashReceived.minus(total).toDecimalPlaces(2).equals(changeAmount)
  ) {
    throw new OfflineSaleSyncError("El efectivo o el vuelto de la venta offline no coinciden.", "OFFLINE_CASH_INVALID", false);
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 100) {
    throw new OfflineSaleSyncError("La venta offline debe incluir entre 1 y 100 articulos.", "OFFLINE_ITEMS_INVALID", false);
  }

  const items = payload.items.map(parseItem);
  const subtotalBeforeSurcharge = payload.subtotalBeforeSurcharge === undefined
    ? undefined
    : parseMoney(payload.subtotalBeforeSurcharge, "subtotalBeforeSurcharge");
  const surcharge = parseSurcharge(payload.surcharge);
  const productIds = items
    .map((item) => item.productId)
    .filter((productId): productId is string => Boolean(productId));
  if (new Set(productIds).size !== productIds.length) {
    throw new OfflineSaleSyncError(
      "La venta offline contiene un producto repetido.",
      "OFFLINE_ITEM_INVALID",
      false
    );
  }

  return {
    clientOperationId,
    businessId: requiredText(payload.businessId, "businessId", 191),
    userId: requiredText(payload.userId, "userId", 191),
    cashSessionId: requiredText(payload.cashSessionId, "cashSessionId", 191),
    occurredAt,
    total: total.toDecimalPlaces(2).toString(),
    subtotalBeforeSurcharge: subtotalBeforeSurcharge?.toDecimalPlaces(2).toString(),
    surcharge,
    cashReceived: cashReceived.toDecimalPlaces(2).toString(),
    changeAmount: changeAmount.toDecimalPlaces(2).toString(),
    items
  };
}

function parseSurcharge(value: unknown): OfflineSaleSyncPayload["surcharge"] {
  if (value === undefined || value === null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    throw new OfflineSaleSyncError("El recargo offline es invalido.", "OFFLINE_SURCHARGE_INVALID", false);
  }

  const surcharge = value as Record<string, unknown>;
  const type = requiredText(surcharge.type, "surcharge.type", 16);
  if (!isSaleSurchargeType(type)) {
    throw new OfflineSaleSyncError("El tipo de recargo offline es invalido.", "OFFLINE_SURCHARGE_INVALID", false);
  }

  const amount = parseMoney(surcharge.amount, "surcharge.amount");
  const rawValue = parseMoney(surcharge.value, "surcharge.value");
  if (amount.lte(0) || rawValue.lte(0) || (type === "PERCENTAGE" && rawValue.gt(1000))) {
    throw new OfflineSaleSyncError("El valor de recargo offline es invalido.", "OFFLINE_SURCHARGE_INVALID", false);
  }

  return {
    type,
    value: rawValue.toDecimalPlaces(type === "PERCENTAGE" ? 4 : 2).toString(),
    amount: amount.toDecimalPlaces(2).toString()
  };
}

function parseItem(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new OfflineSaleSyncError("Uno de los articulos offline es invalido.", "OFFLINE_ITEM_INVALID", false);
  }

  const item = value as Record<string, unknown>;
  const isManual = item.isManual === true;
  const productId = item.productId === null ? null : requiredText(item.productId, "productId", 191);
  if (!isManual && !productId) {
    throw new OfflineSaleSyncError("Un producto de catalogo no tiene identificador.", "OFFLINE_ITEM_INVALID", false);
  }

  const quantity = parseMoney(item.quantity, "quantity");
  const unitPriceSnapshot = parseMoney(item.unitPriceSnapshot, "unitPriceSnapshot");
  const subtotal = parseMoney(item.subtotal, "subtotal");
  if (quantity.lte(0) || unitPriceSnapshot.lte(0) || !unitPriceSnapshot.mul(quantity).toDecimalPlaces(2).equals(subtotal)) {
    throw new OfflineSaleSyncError("El importe de un articulo offline no coincide.", "OFFLINE_ITEM_INVALID", false);
  }

  const unitTypeSnapshot = requiredText(item.unitTypeSnapshot, "unitTypeSnapshot", 20);
  if (!Object.values(UnitType).includes(unitTypeSnapshot as UnitType)) {
    throw new OfflineSaleSyncError("La unidad del articulo offline es invalida.", "OFFLINE_ITEM_INVALID", false);
  }

  return {
    productId,
    isManual,
    nameSnapshot: requiredText(item.nameSnapshot, "nameSnapshot", 80),
    unitPriceSnapshot: unitPriceSnapshot.toString(),
    quantity: quantity.toString(),
    subtotal: subtotal.toString(),
    unitTypeSnapshot,
    allowsDecimalQuantity: item.allowsDecimalQuantity === true
  };
}

function requiredText(value: unknown, field: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    throw new OfflineSaleSyncError(`El campo ${field} es invalido.`, "OFFLINE_PAYLOAD_INVALID", false);
  }
  return text;
}

function parseMoney(value: unknown, field: string) {
  try {
    const amount = parseLocalizedDecimal(value).toDecimalPlaces(2);
    if (amount.lt(0)) {
      throw new Error();
    }
    return amount;
  } catch {
    throw new OfflineSaleSyncError(`El campo ${field} es invalido.`, "OFFLINE_PAYLOAD_INVALID", false);
  }
}

function response(body: OfflineSaleSyncResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
