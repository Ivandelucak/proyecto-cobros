import {
  listOfflineSales,
  resetInterruptedOfflineSales,
  updateOfflineSale
} from "@/lib/offline-sales/offline-db";
import type {
  OfflineCashSale,
  OfflineSaleSyncPayload,
  OfflineSaleSyncResponse
} from "@/lib/offline-sales/types";

type OfflineSyncContext = {
  businessId: string;
  userId: string;
};

export type OfflineSyncSummary = {
  synced: number;
  pending: number;
  requiresLogin: boolean;
  lastError: string | null;
};

export async function syncOfflineCashSales(
  context: OfflineSyncContext,
  onProgress?: (sale: OfflineCashSale) => void
): Promise<OfflineSyncSummary> {
  await resetInterruptedOfflineSales(context.businessId, context.userId);
  const sales = await listOfflineSales(context.businessId, context.userId);
  let synced = 0;
  let requiresLogin = false;
  let lastError: string | null = null;

  for (const sale of sales) {
    if (sale.status === "SYNCED") {
      continue;
    }

    const attemptAt = new Date().toISOString();
    await updateOfflineSale(sale.clientOperationId, {
      status: "SYNCING",
      lastAttemptAt: attemptAt,
      lastError: null
    });
    onProgress?.({ ...sale, status: "SYNCING", lastAttemptAt: attemptAt, lastError: null });

    try {
      const response = await fetch("/api/caja/offline-sales/sync", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(sale))
      });

      if (response.status === 401) {
        requiresLogin = true;
        await updateOfflineSale(sale.clientOperationId, {
          status: "PENDING",
          lastError: "Inicia sesion para sincronizar las ventas pendientes."
        });
        break;
      }

      const result = (await response.json().catch(() => null)) as OfflineSaleSyncResponse | null;
      if (!response.ok || !result || !result.ok) {
        const error =
          result && !result.ok
            ? result.error
            : "No se pudo sincronizar la venta. Se reintentara cuando vuelva la conexion.";
        lastError = error;
        await updateOfflineSale(sale.clientOperationId, {
          status: "ERROR",
          retryCount: sale.retryCount + 1,
          lastError: error,
          lastAttemptAt: new Date().toISOString()
        });
        continue;
      }

      synced += 1;
      await updateOfflineSale(sale.clientOperationId, {
        status: "SYNCED",
        syncedSaleId: result.saleId,
        syncedSaleNumber: result.saleNumber,
        lastError: null,
        lastAttemptAt: new Date().toISOString()
      });
    } catch {
      const error = "No se pudo contactar al servidor. La venta queda guardada para reintentar.";
      lastError = error;
      await updateOfflineSale(sale.clientOperationId, {
        status: "PENDING",
        retryCount: sale.retryCount + 1,
        lastError: error,
        lastAttemptAt: new Date().toISOString()
      });
      break;
    }
  }

  const remaining = await listOfflineSales(context.businessId, context.userId);
  return {
    synced,
    pending: remaining.filter((sale) => sale.status !== "SYNCED").length,
    requiresLogin,
    lastError
  };
}

function toPayload(sale: OfflineCashSale): OfflineSaleSyncPayload {
  return {
    clientOperationId: sale.clientOperationId,
    businessId: sale.businessId,
    userId: sale.userId,
    cashSessionId: sale.cashSessionId,
    occurredAt: sale.occurredAt,
    total: sale.total,
    cashReceived: sale.cashReceived,
    changeAmount: sale.changeAmount,
    items: sale.items
  };
}
