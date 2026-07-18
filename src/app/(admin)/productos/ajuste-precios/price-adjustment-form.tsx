"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { AppModal } from "@/components/ui/overlay";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";
import { formatARS } from "@/lib/money";
import {
  confirmPriceAdjustmentAction,
  previewPriceAdjustmentAction,
  type PriceAdjustmentPreviewItem,
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
  const [previewIsCurrent, setPreviewIsCurrent] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const lastPreviewState = useRef<PriceAdjustmentState | null>(null);

  const preview = useMemo(() => previewState.preview ?? [], [previewState.preview]);
  const canUsePreview = previewIsCurrent;
  const selectedPreview = useMemo(
    () => (canUsePreview ? preview : []).filter((item) => selectedIds.has(item.id)),
    [canUsePreview, preview, selectedIds]
  );
  const selections = useMemo(
    () => selectedPreview.map((item) => ({ id: item.id, expectedPrice: item.currentPrice })),
    [selectedPreview]
  );

  useEffect(() => {
    if (
      previewState.preview &&
      previewState.payload &&
      lastPreviewState.current !== previewState
    ) {
      lastPreviewState.current = previewState;
      setPreviewIsCurrent(true);
      setSelectedIds(new Set(previewState.preview.map((item) => item.id)));
      setIsConfirmModalOpen(false);
    }
  }, [previewState]);

  function invalidatePreview() {
    if (previewIsCurrent) {
      setPreviewIsCurrent(false);
    }
    setIsConfirmModalOpen(false);
  }

  useBarcodeScanner({
    preventDefaultOnScan: true,
    onScan: (code) => {
      setSearch(code);
      setScannedCode(code);
      invalidatePreview();
    }
  });

  const error = confirmState.error ?? previewState.error;
  const hasStalePreview = preview.length > 0 && !canUsePreview && !confirmState.success;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-5 border-b border-[color:var(--panel-border)] pb-4">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Seleccion de productos</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Los cambios no se aplicaran hasta revisar la previsualizacion y confirmar.
          </p>
        </div>
        <form
          action={previewAction}
          className="space-y-5"
          onChange={invalidatePreview}
          onSubmit={() => setPreviewIsCurrent(false)}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Categoria">
              <Select name="categoryId" defaultValue="">
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Marca">
              <Input name="brand" list="price-adjustment-brands" placeholder="Ej: Coca Cola" />
              <datalist id="price-adjustment-brands">
                {brands.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
            </Field>
            <Field label="Coincidencia de marca">
              <Select name="brandMatch" defaultValue="exact">
                <option value="exact">Exacta</option>
                <option value="contains">Contiene</option>
              </Select>
            </Field>
            <Field label="Busqueda general">
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
            </Field>
            <Field label="Contiene texto">
              <Input name="textQuery" placeholder="Ej: coca" />
            </Field>
            <Field label="Buscar texto en">
              <Select name="textSearchScope" defaultValue="name_or_brand">
                <option value="name_or_brand">Nombre o marca</option>
                <option value="name">Nombre</option>
                <option value="brand">Marca</option>
              </Select>
            </Field>
            <Field label="Acceso rapido">
              <Select name="quickAccess" defaultValue="all">
                <option value="all">Todos</option>
                <option value="yes">Solo acceso rapido</option>
                <option value="no">Sin acceso rapido</option>
              </Select>
            </Field>
            <Field label="Stock">
              <Select name="stock" defaultValue="all">
                <option value="all">Todos</option>
                <option value="with">Con stock</option>
                <option value="without">Sin stock</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-[var(--text-secondary)]">
              <input
                type="checkbox"
                name="activeOnly"
                defaultChecked
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Solo activos
            </label>
          </div>

          <div className="border-t border-[color:var(--panel-border)] pt-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Configuracion del ajuste</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                El porcentaje se calcula sobre el precio de venta actual de cada producto.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Porcentaje">
                <Input name="percent" inputMode="decimal" placeholder="Ej: 10 o 10,5" required />
              </Field>
              <Field label="Tipo">
                <Select name="direction" defaultValue="increase">
                  <option value="increase">Aumentar</option>
                  <option value="decrease">Reducir</option>
                </Select>
              </Field>
              <Field label="Redondeo">
                <Select name="rounding" defaultValue="none">
                  <option value="none">Sin redondeo</option>
                  <option value="10">Multiplo de 10 mas cercano</option>
                  <option value="50">Multiplo de 50 mas cercano</option>
                  <option value="100">Multiplo de 100 mas cercano</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--panel-border)] pt-4">
            <BarcodeFeedback
              code={scannedCode || null}
              message={
                scannedCode
                  ? "Codigo cargado como busqueda general para previsualizar."
                  : "Escanea un codigo para cargarlo como busqueda general."
              }
              tone={scannedCode ? "ok" : "info"}
            />
            <Button type="submit" variant="primary" disabled={previewPending}>
              {previewPending ? "Calculando..." : "Previsualizar"}
            </Button>
          </div>
        </form>
      </Card>

      {error && !canUsePreview ? <Alert tone="error">{error}</Alert> : null}
      {confirmState.success && !canUsePreview ? <Alert tone="success">{confirmState.success}</Alert> : null}

      {hasStalePreview ? (
        <Alert tone="warning">
          Los filtros o el ajuste cambiaron. Genera una nueva previsualizacion antes de aplicar.
        </Alert>
      ) : null}

      {canUsePreview ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-[color:var(--panel-border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Previsualizacion</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {preview.length} encontrados, {selectedPreview.length} seleccionados. No se aplicara nada hasta confirmar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set(preview.map((item) => item.id)))}
              >
                Seleccionar todos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpiar seleccion
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={selectedPreview.length === 0}
                onClick={() => setIsConfirmModalOpen(true)}
              >
                Aplicar ajuste
              </Button>
            </div>
          </div>

          {previewState.adjustment ? (
            <div className="grid gap-3 border-b border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-5 py-3 text-sm sm:grid-cols-4">
              <Summary label="Porcentaje" value={`${previewState.adjustment.percent}%`} />
              <Summary label="Tipo" value={previewState.adjustment.direction === "increase" ? "Aumento" : "Reduccion"} />
              <Summary label="Redondeo" value={roundingLabel(previewState.adjustment.rounding)} />
              <Summary label="Variacion acumulada" value={formatARS(previewState.adjustment.totalDifference)} />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="w-12 px-4 py-3 font-medium" scope="col">
                    <span className="sr-only">Seleccionar</span>
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">Producto</th>
                  <th className="px-4 py-3 font-medium" scope="col">Categoria</th>
                  <th className="px-4 py-3 font-medium" scope="col">Marca</th>
                  <th className="px-4 py-3 font-medium" scope="col">Actual</th>
                  <th className="px-4 py-3 font-medium" scope="col">Porcentaje</th>
                  <th className="px-4 py-3 font-medium" scope="col">Tipo</th>
                  <th className="px-4 py-3 font-medium" scope="col">Nuevo</th>
                  <th className="px-4 py-3 font-medium" scope="col">Diferencia</th>
                  <th className="px-4 py-3 font-medium" scope="col">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--panel-border)]">
                {preview.map((item) => (
                  <PreviewRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    adjustment={previewState.adjustment}
                    onChange={(checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <AppModal
        open={isConfirmModalOpen && canUsePreview}
        title="Confirmar ajuste de precios"
        description="Se recalcularan los precios seleccionados en el servidor antes de guardar. Los productos que hayan cambiado desde esta preview se omitiran."
        onClose={() => !confirmPending && setIsConfirmModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={confirmPending} onClick={() => setIsConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <form
              action={confirmAction}
              onSubmit={() => {
                setIsConfirmModalOpen(false);
                setPreviewIsCurrent(false);
                setSelectedIds(new Set());
              }}
            >
              <input type="hidden" name="payload" value={previewState.payload ?? ""} />
              <input type="hidden" name="snapshot" value={JSON.stringify(preview)} />
              <input type="hidden" name="proof" value={previewState.proof ?? ""} />
              <input type="hidden" name="selections" value={JSON.stringify(selections)} />
              <Button type="submit" variant="primary" disabled={confirmPending || selections.length === 0}>
                {confirmPending ? "Aplicando..." : "Aplicar cambios"}
              </Button>
            </form>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Productos" value={String(selectedPreview.length)} />
          <Summary
            label="Tipo"
            value={previewState.adjustment?.direction === "decrease" ? "Reduccion" : "Aumento"}
          />
          <Summary label="Porcentaje" value={`${previewState.adjustment?.percent ?? "0"}%`} />
        </div>
      </AppModal>
    </div>
  );
}

function PreviewRow({
  item,
  selected,
  adjustment,
  onChange
}: {
  item: PriceAdjustmentPreviewItem;
  selected: boolean;
  adjustment: PriceAdjustmentState["adjustment"];
  onChange: (checked: boolean) => void;
}) {
  const positive = Number(item.difference) >= 0;

  return (
    <tr className="bg-[var(--panel-bg)] hover:bg-[var(--panel-bg-elevated)]">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={`Seleccionar ${item.name}`}
          className="h-4 w-4 accent-[var(--primary)]"
        />
      </td>
      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{item.name}</td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">{item.categoryName}</td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">{item.brand ?? "-"}</td>
      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{formatARS(item.currentPrice)}</td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">{adjustment?.percent ?? "-"}%</td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">
        {adjustment?.direction === "decrease" ? "Reduccion" : "Aumento"}
      </td>
      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{formatARS(item.newPrice)}</td>
      <td className={positive ? "px-4 py-3 font-semibold text-[var(--success)]" : "px-4 py-3 font-semibold text-[var(--danger)]"}>
        {positive ? "+" : ""}{formatARS(item.difference)}
      </td>
      <td className="px-4 py-3">
        <span className={selected ? "badge-success" : "badge-neutral"}>
          {selected ? "Seleccionado" : "Omitido"}
        </span>
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function Alert({ tone, children }: { tone: "error" | "success" | "warning"; children: React.ReactNode }) {
  const className = tone === "error" ? "badge-danger" : tone === "success" ? "badge-success" : "badge-warning";
  return <p className={`${className} rounded-md px-3 py-2 text-sm`}>{children}</p>;
}

function roundingLabel(rounding: string) {
  if (rounding === "10") return "Multiplo de 10";
  if (rounding === "50") return "Multiplo de 50";
  if (rounding === "100") return "Multiplo de 100";
  return "Sin redondeo";
}
