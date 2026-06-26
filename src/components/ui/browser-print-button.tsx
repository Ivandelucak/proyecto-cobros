"use client";

import { Button } from "@/components/ui/button";

export function BrowserPrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
