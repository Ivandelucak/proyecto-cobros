"use client";

import { useActionState, useState } from "react";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";
import { formatARS } from "@/lib/money";
import {
  confirmPriceAdjustmentAction,
  previewPriceAdjustmentAction,
  type PriceAdjustmentState
} from "./actions";

type CategoryOption = {
  id: string;
  name: string;
};

const initialState: PriceAdjustmentState = {};

export function PriceAdjustmentForm({
  categories,
  brands
}: {
  categories: CategoryOption[];
  brands: string[];
}) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewPriceAdjustmentAction,
    initialState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmPriceAdjustmentAction,
    initialState
  );
  const [search, setSearch] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const state = confirmState.success || confirmState.error ? confirmState : previewState;

  useBarcodeScanner({
    preventDefaultOnScan: true,
    onScan: (code) => {
      setSearch(code);
      setScannedCode(code);
    }
  });

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <form action={previewAction} className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Categoria
            </span>
            <Select name="categoryId" defaultValue="">
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Marca
            </span>
            <Input name="brand" list="price-adjustment-brands" placeholder="Ej: Coca Cola" />
            <datalist id="price-adjustment-brands">
              {brands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Coincidencia marca
            </span>
            <Select name="brandMatch" defaultValue="exact">
              <option value="exact">Exacta</option>
              <option value="contains">Contiene</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Busqueda
            </span>
            <Input
              name="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (!event.target.value.trim()) {
                  setScannedCode("");
                }
              }}
              placeholder="Nombre, SKU, codigo o marca"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Acceso rapido
            </span>
            <Select name="quickAccess" defaultValue="all">
              <option value="all">Todos</option>
              <option value="yes">Solo acceso rapido</option>
              <option value="no">Sin acceso rapido</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Stock
            </span>
            <Select name="stock" defaultValue="all">
              <option value="all">Todos</option>
              <option value="with">Con stock</option>
              <option value="without">Sin stock</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Porcentaje
            </span>
            <Input name="percent" inputMode="decimal" placeholder="Ej: 10" required />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Tipo
            </span>
            <Select name="direction" defaultValue="increase">
              <option value="increase">Aumentar</option>
              <option value="decrease">Reducir</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Redondeo
            </span>
            <Select name="rounding" defaultValue="none">
              <option value="none">Sin redondeo</option>
              <option value="10">Multiplo de 10</option>
              <option value="50">Multiplo de 50</option>
              <option value="100">Multiplo de 100</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              name="activeOnly"
              defaultChecked
              className="h-4 w-4 accent-brand-600"
            />
            Solo activos
          </label>
          <div className="md:col-span-2 md:text-right">
            <Button type="submit" variant="primary" disabled={previewPending}>
              {previewPending ? "Calculando..." : "Previsualizar"}
            </Button>
          </div>
        </form>
        <div className="mt-4">
          <BarcodeFeedback
            code={scannedCode || null}
            message={
              scannedCode
                ? "Codigo cargado como busqueda para previsualizar el ajuste."
                : "Escanea un codigo para cargarlo como busqueda."
            }
            tone={scannedCode ? "ok" : "info"}
          />
        </div>
      </Card>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
          {state.success}
        </p>
      ) : null}

      {previewState.preview ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Preview ({previewState.preview.length} productos afectados)
            </h2>
            <form action={confirmAction}>
              <input type="hidden" name="payload" value={previewState.payload} />
              <Button type="submit" variant="destructive" disabled={confirmPending}>
                {confirmPending ? "Aplicando..." : "Confirmar ajuste"}
              </Button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 font-medium">Actual</th>
                  <th className="px-4 py-3 font-medium">Nuevo</th>
                  <th className="px-4 py-3 font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {previewState.preview.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {item.categoryName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {item.brand ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {formatARS(item.currentPrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {formatARS(item.newPrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {formatARS(item.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
