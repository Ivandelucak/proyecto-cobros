"use client";

import { useRouter } from "next/navigation";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";

export function StockBarcodeFilter({ scannedCode }: { scannedCode: string }) {
  const router = useRouter();

  useBarcodeScanner({
    preventDefaultOnScan: true,
    onScan: (code) => {
      const params = new URLSearchParams();
      params.set("barcode", code);
      params.set("filter", "all");
      router.push(`/stock?${params.toString()}`);
    }
  });

  return (
    <BarcodeFeedback
      code={scannedCode || null}
      message={
        scannedCode
          ? "Filtro exacto por codigo aplicado en stock."
          : "Escanea un codigo para buscar stock exacto."
      }
      tone={scannedCode ? "ok" : "info"}
    />
  );
}
