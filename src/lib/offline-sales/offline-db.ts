import type {
  OfflineCashContext,
  OfflineCashSale,
  OfflineCatalogProduct,
  OfflineSaleStatus
} from "@/lib/offline-sales/types";

const DATABASE_NAME = "foxpoint-offline-sales";
const DATABASE_VERSION = 1;
const CATALOG_STORE = "catalog";
const CONTEXT_STORE = "cash-context";
const SALES_STORE = "sales";

export function isOfflineStorageAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export async function saveOfflineCatalog(
  businessId: string,
  products: OfflineCatalogProduct[]
) {
  await withStore(CATALOG_STORE, "readwrite", (store) =>
    request(
      store.put({
        businessId,
        products,
        updatedAt: new Date().toISOString()
      })
    )
  );
}

export async function getOfflineCatalog(businessId: string) {
  const record = await withStore(CATALOG_STORE, "readonly", (store) =>
    request<{ products: OfflineCatalogProduct[] } | undefined>(store.get(businessId))
  );
  return record?.products ?? [];
}

export async function saveOfflineCashContext(context: OfflineCashContext) {
  await withStore(CONTEXT_STORE, "readwrite", (store) => request(store.put(context)));
}

export async function hasOfflineCashContext(contextId: string) {
  const context = await withStore(CONTEXT_STORE, "readonly", (store) =>
    request<OfflineCashContext | undefined>(store.get(contextId))
  );
  return Boolean(context);
}

export async function enqueueOfflineSale(sale: OfflineCashSale) {
  await withStore(SALES_STORE, "readwrite", (store) => request(store.put(sale)));
}

export async function listOfflineSales(
  businessId: string,
  userId: string,
  cashSessionId?: string
) {
  const sales = await withStore(SALES_STORE, "readonly", (store) =>
    request<OfflineCashSale[]>(store.getAll())
  );

  return sales
    .filter(
      (sale) =>
        sale.businessId === businessId &&
        sale.userId === userId &&
        (!cashSessionId || sale.cashSessionId === cashSessionId)
    )
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export async function countPendingOfflineSales(businessId: string, userId: string) {
  const sales = await listOfflineSales(businessId, userId);
  return sales.filter((sale) => sale.status !== "SYNCED").length;
}

export async function updateOfflineSale(
  clientOperationId: string,
  patch: Partial<OfflineCashSale>
) {
  await withStore(SALES_STORE, "readwrite", async (store) => {
    const sale = await request<OfflineCashSale | undefined>(store.get(clientOperationId));
    if (!sale) {
      return;
    }
    await request(store.put({ ...sale, ...patch }));
  });
}

export async function resetInterruptedOfflineSales(businessId: string, userId: string) {
  const sales = await listOfflineSales(businessId, userId);
  await Promise.all(
    sales
      .filter((sale) => sale.status === "SYNCING")
      .map((sale) =>
        updateOfflineSale(sale.clientOperationId, {
          status: "PENDING",
          lastError: "La sincronizacion anterior se interrumpio. Se reintentara automaticamente."
        })
      )
  );
}

export async function applyOfflineStockDecrease(
  businessId: string,
  productId: string,
  quantity: string
) {
  await withStore(CATALOG_STORE, "readwrite", async (store) => {
    const record = await request<{
      businessId: string;
      products: OfflineCatalogProduct[];
      updatedAt: string;
    } | undefined>(store.get(businessId));
    if (!record) {
      return;
    }

    const decrease = Number(quantity);
    if (!Number.isFinite(decrease)) {
      return;
    }

    record.products = record.products.map((product) =>
      product.id === productId
        ? { ...product, stock: String(roundQuantity(Number(product.stock) - decrease)) }
        : product
    );
    await request(store.put(record));
  });
}

export function isPendingOfflineSaleStatus(status: OfflineSaleStatus) {
  return status === "PENDING" || status === "SYNCING" || status === "ERROR";
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>
) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, mode);
  const done = transactionDone(transaction);
  try {
    const result = await operation(transaction.objectStore(storeName));
    await done;
    return result;
  } finally {
    database.close();
  }
}

function openDatabase() {
  if (!isOfflineStorageAvailable()) {
    return Promise.reject(new Error("Este navegador no permite almacenamiento offline."));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CATALOG_STORE)) {
        database.createObjectStore(CATALOG_STORE, { keyPath: "businessId" });
      }
      if (!database.objectStoreNames.contains(CONTEXT_STORE)) {
        database.createObjectStore(CONTEXT_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SALES_STORE)) {
        database.createObjectStore(SALES_STORE, { keyPath: "clientOperationId" });
      }
    };
  });
}

function request<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("No se pudo guardar el dato offline."));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("La transaccion offline fallo."));
    transaction.onabort = () => reject(transaction.error ?? new Error("La transaccion offline fue cancelada."));
  });
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
