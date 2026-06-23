"use client";

import { useState } from "react";
import { recordTicketPrintAction } from "@/app/(sales)/ventas/print-actions";
import { Button } from "@/components/ui/button";
import type { PrintSettingView } from "@/lib/print-settings";
import { isSafeInternalReturnTo } from "@/lib/return-to";

type PrintButtonProps = {
  saleId?: string;
  setting?: PrintSettingView;
  printHref?: string;
  autoFocus?: boolean;
};

export function PrintButton({
  saleId,
  setting,
  printHref,
  autoFocus
}: PrintButtonProps) {
  const [status, setStatus] = useState<{
    tone: "ok" | "error" | "muted";
    text: string;
  } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePrint() {
    setStatus(null);

    if (window.posElectron?.isElectron && saleId) {
      if (setting?.silentPrint && !setting.printerName) {
        const error = "La impresion silenciosa requiere una impresora seleccionada.";
        setStatus({ tone: "error", text: error });
        await recordTicketPrintAction({ saleId, ok: false, error });
        return;
      }

      setIsPrinting(true);
      setStatus({ tone: "muted", text: "Imprimiendo..." });

      const result = await window.posElectron.printTicket(saleId, {
        printerName: setting?.printerName ?? null,
        paperSize: setting?.paperSize ?? "TICKET_80",
        silent: setting?.silentPrint ?? false,
        copies: setting?.copies ?? 1,
        marginMm: setting?.marginMm ?? 2
      });

      setIsPrinting(false);

      if (result.ok) {
        setStatus({ tone: "ok", text: "Ticket impreso correctamente." });
        await recordTicketPrintAction({ saleId, ok: true });
        return;
      }

      const error = result.error || "No se pudo imprimir el ticket";
      setStatus({ tone: "error", text: error });
      await recordTicketPrintAction({ saleId, ok: false, error });
      return;
    }

    if (printHref) {
      if (!isSafeInternalReturnTo(printHref)) {
        const error = "Ruta de ticket invalida.";
        setStatus({ tone: "error", text: error });
        if (saleId) {
          await recordTicketPrintAction({ saleId, ok: false, error });
        }
        return;
      }

      const ticketWindow = window.open(
        printHref,
        "_blank",
        "popup,width=420,height=720"
      );

      if (!ticketWindow) {
        window.location.assign(printHref);
        return;
      }

      if (saleId) {
        await recordTicketPrintAction({ saleId, ok: true });
      }
      setStatus({ tone: "ok", text: "Ticket abierto para imprimir." });
      return;
    }

    window.print();
    if (saleId) {
      await recordTicketPrintAction({ saleId, ok: true });
    }
    setStatus({ tone: "ok", text: "Dialogo de impresion abierto." });
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <Button
        type="button"
        variant="primary"
        onClick={handlePrint}
        disabled={isPrinting}
        autoFocus={autoFocus}
      >
        {isPrinting ? "Imprimiendo..." : "Imprimir ticket"}
      </Button>
      {status ? (
        <span
          className={
            status.tone === "ok"
              ? "text-xs font-medium text-emerald-700 dark:text-emerald-300"
              : status.tone === "error"
                ? "text-xs font-medium text-red-700 dark:text-red-300"
                : "text-xs font-medium text-gray-500 dark:text-gray-400"
          }
        >
          {status.text}
        </span>
      ) : null}
    </span>
  );
}
