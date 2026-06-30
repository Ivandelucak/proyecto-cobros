"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { PrintPaperSize } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { PrintSettingView } from "@/lib/print-settings";
import { updatePrintSettingsAction, type PrintSettingsState } from "./actions";

type PrintSettingsFormProps = {
  initialSetting: PrintSettingView;
  paperSizeLabels: Record<PrintPaperSize, string>;
};

const initialState: PrintSettingsState = {};

export function PrintSettingsForm({
  initialSetting,
  paperSizeLabels
}: PrintSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updatePrintSettingsAction,
    initialState
  );
  const [desktopAvailable, setDesktopAvailable] = useState<boolean | null>(null);
  const [printers, setPrinters] = useState<PosElectronPrinter[]>([]);
  const [printerError, setPrinterError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrinters() {
      const electronApi = window.posElectron;
      if (!electronApi?.isElectron) {
        if (!cancelled) {
          setDesktopAvailable(false);
        }
        return;
      }

      if (!cancelled) {
        setDesktopAvailable(true);
      }

      try {
        const availablePrinters = await electronApi.getPrinters();
        if (cancelled) {
          return;
        }
        setPrinters(availablePrinters);
        setPrinterError(null);
      } catch {
        if (cancelled) {
          return;
        }
        setPrinterError("No se pudieron leer las impresoras disponibles.");
      }
    }

    void loadPrinters();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasCurrentPrinterInList = useMemo(
    () =>
      initialSetting.printerName
        ? printers.some((printer) => printer.name === initialSetting.printerName)
        : true,
    [initialSetting.printerName, printers]
  );
  const desktopStatusLabel =
    desktopAvailable === null
      ? "Detectando entorno"
      : desktopAvailable
        ? "App de escritorio"
        : "Navegador web";

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-950 dark:text-[#F3F7FA]">
            Impresora de tickets
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-[#A9B6C2]">
            La seleccion de impresora se usa desde la app de escritorio. En
            navegador se usara el dialogo de impresion.
          </p>
        </div>

        {state.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-md border border-[#BFE3D2] bg-[#E8F6EF] px-3 py-2 text-sm text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]">
            {state.success}
          </p>
        ) : null}

        {desktopAvailable === false ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            La seleccion de impresora se usa desde la app de escritorio. En
            navegador se usara el dialogo de impresion.
            <input
              type="hidden"
              name="printerName"
              value={initialSetting.printerName ?? "__none"}
            />
          </div>
        ) : (
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Impresora
            </span>
            <Select
              name="printerName"
              defaultValue={initialSetting.printerName ?? "__none"}
              disabled={desktopAvailable === null}
            >
              <option value="__none">Sin impresora configurada</option>
              {!hasCurrentPrinterInList && initialSetting.printerName ? (
                <option value={initialSetting.printerName}>
                  {initialSetting.printerName} (no detectada)
                </option>
              ) : null}
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName}
                  {printer.isDefault ? " - predeterminada" : ""}
                </option>
              ))}
            </Select>
            {printerError ? (
              <span className="text-xs text-red-600 dark:text-red-300">
                {printerError}
              </span>
            ) : null}
          </label>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Tamano de papel
            </span>
            <Select name="paperSize" defaultValue={initialSetting.paperSize}>
              {Object.entries(paperSizeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Estado
            </span>
            <Input
              value={desktopStatusLabel}
              readOnly
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Copias
            </span>
            <Input
              name="copies"
              type="number"
              min={1}
              max={5}
              step={1}
              defaultValue={initialSetting.copies}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Margen en mm
            </span>
            <Input
              name="marginMm"
              type="number"
              min={0}
              max={12}
              step={1}
              defaultValue={initialSetting.marginMm}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            name="silentPrint"
            label="Impresion silenciosa"
            description="Imprime sin dialogo. Requiere impresora seleccionada."
            defaultChecked={initialSetting.silentPrint}
          />
          <Toggle
            name="autoPrintTicket"
            label="Imprimir automaticamente al finalizar venta"
            description="Si falla la impresion, la venta queda confirmada igual."
            defaultChecked={initialSetting.autoPrintTicket}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar configuracion"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#273342] dark:bg-[#121922]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
      />
      <span>
        <span className="block text-sm font-medium text-gray-950 dark:text-[#F3F7FA]">
          {label}
        </span>
        <span className="mt-1 block text-sm leading-5 text-gray-600 dark:text-[#A9B6C2]">
          {description}
        </span>
      </span>
    </label>
  );
}
