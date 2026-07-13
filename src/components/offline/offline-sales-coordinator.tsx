"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  countPendingOfflineSales,
  isOfflineStorageAvailable
} from "@/lib/offline-sales/offline-db";
import {
  syncOfflineCashSales,
  type OfflineSyncSummary
} from "@/lib/offline-sales/offline-sync";

type OfflineConnection = "CHECKING" | "ONLINE" | "OFFLINE";

type OfflineSalesContextValue = {
  connection: OfflineConnection;
  pendingCount: number;
  refreshPendingCount: () => Promise<number>;
  syncPendingSales: () => Promise<OfflineSyncSummary | null>;
};

const OfflineSalesContext = createContext<OfflineSalesContextValue | null>(null);

// The authenticated shell is normally mounted once, but this also protects against
// strict-mode effects or a quick route remount attempting the same queue in parallel.
let activeSync: Promise<OfflineSyncSummary | null> | null = null;

export function OfflineSalesCoordinator({
  businessId,
  userId,
  children
}: {
  businessId: string | null;
  userId: string;
  children: ReactNode;
}) {
  const [connection, setConnection] = useState<OfflineConnection>("CHECKING");
  const [pendingCount, setPendingCount] = useState(0);
  const pendingCountRef = useRef(0);

  const refreshPendingCount = useCallback(async () => {
    if (!businessId || !isOfflineStorageAvailable()) {
      pendingCountRef.current = 0;
      setPendingCount(0);
      return 0;
    }

    const count = await countPendingOfflineSales(businessId, userId);
    pendingCountRef.current = count;
    setPendingCount(count);
    return count;
  }, [businessId, userId]);

  const syncPendingSales = useCallback(async () => {
    if (!businessId || !isOfflineStorageAvailable()) {
      return null;
    }

    if (activeSync) {
      return activeSync;
    }

    const promise = (async () => {
      try {
        return await syncOfflineCashSales({ businessId, userId });
      } finally {
        await refreshPendingCount().catch(() => undefined);
        activeSync = null;
      }
    })();
    activeSync = promise;

    return promise;
  }, [businessId, refreshPendingCount, userId]);

  useEffect(() => {
    if (!businessId || !isOfflineStorageAvailable()) {
      return;
    }

    let active = true;
    let timer: number | undefined;
    let failures = 0;

    const schedule = (delay: number) => {
      timer = window.setTimeout(checkConnection, delay);
    };

    const checkConnection = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5_000);
      let healthy = false;

      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });
        healthy = response.ok;
      } catch {
        healthy = false;
      } finally {
        window.clearTimeout(timeout);
      }

      if (!active) {
        return;
      }

      if (healthy) {
        failures = 0;
        setConnection("ONLINE");
        void syncPendingSales();
        schedule(45_000);
      } else {
        failures += 1;
        setConnection("OFFLINE");
        schedule(Math.min(120_000, 15_000 * 2 ** Math.min(failures, 3)));
      }
    };

    const onOnline = () => void checkConnection();
    const onOffline = () => setConnection("OFFLINE");
    timer = window.setTimeout(() => {
      void refreshPendingCount();
      void checkConnection();
    }, 0);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [businessId, refreshPendingCount, syncPendingSales]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingCountRef.current <= 0) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, []);

  const value = useMemo<OfflineSalesContextValue>(
    () => ({ connection, pendingCount, refreshPendingCount, syncPendingSales }),
    [connection, pendingCount, refreshPendingCount, syncPendingSales]
  );

  return <OfflineSalesContext.Provider value={value}>{children}</OfflineSalesContext.Provider>;
}

export function useOfflineSales() {
  const context = useContext(OfflineSalesContext);
  if (!context) {
    throw new Error("useOfflineSales must be used inside OfflineSalesCoordinator.");
  }
  return context;
}
