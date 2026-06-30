"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { formatARS } from "@/lib/money";
import type { ProductImportPreviewRow } from "@/lib/excel/products-import";
import {
  confirmProductsImportAction,
  previewProductsImportAction,
  type ImportProductsState
} from "./actions";

const initialState: ImportProductsState = {};
const acceptedColumns = [
  "nombre",
  "codigo_barras",
  "sku",
  "categoria",
  "marca",
  "precio_venta",
  "costo",
  "stock",
  "stock_minimo",
  "unidad",
  "activo",
  "acceso_rapido"
];
const importRules = [
  "No se eliminan productos existentes.",
  "Si el codigo de barras o SKU ya existe, se actualiza.",
  "Las categorias inexistentes se crean automaticamente."
];

export function ImportProductsForm() {
  const [previewState, previewAction, previewPending] = useActionState(
    previewProductsImportAction,
    initialState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmProductsImportAction,
    initialState
  );
  const state = confirmState.result || confirmState.error ? confirmState : previewState;
  const preview = previewState.preview;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Importacion segura
              </h2>
              <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-[#A9B6C2]">
                {importRules.map((rule) => (
                  <p key={rule}>{rule}</p>
                ))}
              </div>
            </div>
            <LinkButton href="/productos/plantilla" variant="primary">
              Descargar plantilla
            </LinkButton>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
            Columnas aceptadas
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {acceptedColumns.map((column) => (
              <Badge key={column} tone="blue">
                {column}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <form action={previewAction} className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Subi tu archivo Excel
            </span>
            <input
              type="file"
              name="file"
              accept=".xlsx"
              required
              className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-800 dark:border-[#344457] dark:bg-[#121922] dark:text-[#F3F7FA] dark:file:bg-[#273342] dark:file:text-gray-100"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" disabled={previewPending}>
              {previewPending ? "Leyendo..." : "Previsualizar"}
            </Button>
            <LinkButton href="/productos/plantilla">Plantilla</LinkButton>
          </div>
        </form>
      </Card>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
            Importacion finalizada
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Creados" value={state.result.created} />
            <SummaryCard label="Actualizados" value={state.result.updated} />
            <SummaryCard label="Omitidos" value={state.result.skipped} />
            <SummaryCard label="Movimientos" value={state.result.stockMovements} />
            <SummaryCard label="Categorias" value={state.result.categoriesCreated} />
          </div>
          <div className="mt-4 flex gap-2">
            <LinkButton href="/productos" variant="primary">
              Ver productos
            </LinkButton>
            <LinkButton href="/productos/importar">Importar otro archivo</LinkButton>
          </div>
        </Card>
      ) : null}

      {preview ? (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                  Revisa los productos antes de importar
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">
                  Solo se importan las filas validas. Las filas con error quedan afuera.
                </p>
              </div>
              <form action={confirmAction}>
                <textarea
                  name="rowsJson"
                  readOnly
                  value={preview.rowsJson}
                  className="hidden"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={confirmPending || preview.summary.validCount === 0}
                >
                  {confirmPending ? "Importando..." : "Confirmar importacion"}
                </Button>
              </form>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Nuevos" value={preview.summary.createCount} />
              <SummaryCard label="Actualizados" value={preview.summary.updateCount} />
              <SummaryCard label="Con error" value={preview.summary.errorCount} />
              <SummaryCard
                label="Categorias nuevas"
                value={preview.summary.newCategories.length}
              />
            </div>

            {preview.summary.newCategories.length > 0 ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-[#A9B6C2]">
                Se crearan: {preview.summary.newCategories.join(", ")}
              </p>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fila</th>
                    <th className="px-4 py-3 font-medium">Accion</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Codigo</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Precio</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {preview.rows.map((row) => (
                    <PreviewRow key={`${row.rowNumber}-${row.barcode}-${row.sku}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function PreviewRow({ row }: { row: ProductImportPreviewRow }) {
  return (
    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60">
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">{row.rowNumber}</td>
      <td className="px-4 py-3">
        <Badge tone={row.action === "error" ? "red" : row.action === "create" ? "green" : "blue"}>
          {actionLabel(row.action)}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-950 dark:text-[#F3F7FA]">
          {row.name || row.productName || "-"}
        </div>
        {row.productName && row.action === "update" ? (
          <div className="text-xs text-gray-500 dark:text-[#7F8D9A]">
            Actualiza {row.productName}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">{row.barcode ?? "-"}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">{row.sku ?? "-"}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
        {row.category || "-"}
        {row.categoryWillBeCreated && row.action !== "error" ? (
          <span className="ml-2 text-xs text-brand-700 dark:text-brand-200">nueva</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
        {row.salePrice ? formatARS(row.salePrice) : "-"}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">{row.stock ?? "-"}</td>
      <td className="px-4 py-3 text-red-700 dark:text-red-300">
        {row.errors.length > 0 ? row.errors.join(" ") : "-"}
      </td>
    </tr>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#273342] dark:bg-[#121922]">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-[#7F8D9A]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-[#F3F7FA]">{value}</p>
    </div>
  );
}

function actionLabel(action: ProductImportPreviewRow["action"]) {
  const labels = {
    create: "Crear",
    update: "Actualizar",
    error: "Error"
  };

  return labels[action];
}
