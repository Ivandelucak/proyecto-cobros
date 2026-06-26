"use client";

import { useRouter } from "next/navigation";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";

export function ProductsBarcodeFilter({ scannedCode }: { scannedCode: string }) {
  const router = useRouter();

  useBarcodeScanner({
    preventDefaultOnScan: true,
    onScan: (code) => {
      const params = new URLSearchParams();
      params.set("barcode", code);
      params.set("status", "all");
      router.push(`/productos?${params.toString()}`);
    }
  });

  return (
    <BarcodeFeedback
      code={scannedCode || null}
      message={
        scannedCode
          ? "Filtro exacto por codigo de barras aplicado."
          : "Escanea un codigo para filtrar un producto exacto."
      }
      tone={scannedCode ? "ok" : "info"}
    />
  );
}
