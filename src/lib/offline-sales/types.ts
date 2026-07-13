export type OfflineSaleStatus = "PENDING" | "SYNCING" | "SYNCED" | "ERROR";

export type OfflineCatalogProduct = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  salePrice: string;
  stock: string;
  unitType: string;
  allowsDecimalQuantity: boolean;
  categoryName: string;
  quickAccess: boolean;
  active: boolean;
};

export type OfflineCashContext = {
  id: string;
  businessId: string;
  userId: string;
  cashSessionId: string;
  preparedAt: string;
};

export type OfflineSaleItem = {
  productId: string | null;
  isManual: boolean;
  nameSnapshot: string;
  unitPriceSnapshot: string;
  quantity: string;
  subtotal: string;
  unitTypeSnapshot: string;
  allowsDecimalQuantity: boolean;
};

export type OfflineCashSale = {
  clientOperationId: string;
  businessId: string;
  userId: string;
  cashSessionId: string;
  occurredAt: string;
  total: string;
  cashReceived: string;
  changeAmount: string;
  items: OfflineSaleItem[];
  status: OfflineSaleStatus;
  retryCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  syncedSaleId: string | null;
  syncedSaleNumber: number | null;
  offlineNumber: string;
};

export type OfflineSaleSyncPayload = Pick<
  OfflineCashSale,
  | "clientOperationId"
  | "businessId"
  | "userId"
  | "cashSessionId"
  | "occurredAt"
  | "total"
  | "cashReceived"
  | "changeAmount"
  | "items"
>;

export type OfflineSaleSyncResponse =
  | {
      ok: true;
      saleId: string;
      saleNumber: number;
      alreadySynced: boolean;
      lateCashSession: boolean;
    }
  | {
      ok: false;
      code: string;
      error: string;
      retryable: boolean;
    };

export function offlineContextId(
  businessId: string,
  userId: string,
  cashSessionId: string
) {
  return `${businessId}:${userId}:${cashSessionId}`;
}
