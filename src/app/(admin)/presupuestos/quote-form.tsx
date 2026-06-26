"use client";

import { useActionState, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrashIcon } from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";
import { formatARS } from "@/lib/money";
import {
  findQuoteProductByBarcodeAction,
  searchQuoteCustomersAction,
  searchQuoteProductsAction,
  type QuoteCustomerResult,
  type QuoteFormState,
  type QuoteProductResult
} from "./actions";

type QuoteItemDraft = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: string;
  unitPrice: string;
  unitType: string;
  notes: string;
  categoryName?: string;
};

type InitialQuoteValues = {
  customerId?: string | null;
  customerName?: string;
  customerDocument?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  validUntil?: string;
  notes?: string | null;
  terms?: string | null;
  discountTotal?: string;
  surchargeTotal?: string;
  items?: QuoteItemDraft[];
};

type QuoteFormProps = {
  action: (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  submitLabel: string;
  initialValues?: InitialQuoteValues;
};

const initialState: QuoteFormState = {};

export function QuoteForm({ action, submitLabel, initialValues }: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [isSearching, startSearchTransition] = useTransition();
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<QuoteProductResult[]>([]);
  const [customerQuery, setCustomerQuery] = useState(initialValues?.customerName ?? "");
  const [customerResults, setCustomerResults] = useState<QuoteCustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<QuoteCustomerResult | null>(
    initialValues?.customerId
      ? {
          id: initialValues.customerId,
          name: initialValues.customerName ?? "",
          document: initialValues.customerDocument ?? null,
          phone: initialValues.customerPhone ?? null,
          email: initialValues.customerEmail ?? null
        }
      : null
  );
  const [manualDocument, setManualDocument] = useState(initialValues?.customerDocument ?? "");
  const [manualPhone, setManualPhone] = useState(initialValues?.customerPhone ?? "");
  const [manualEmail, setManualEmail] = useState(initialValues?.customerEmail ?? "");
  const [items, setItems] = useState<QuoteItemDraft[]>(initialValues?.items ?? []);
  const [validUntil, setValidUntil] = useState(initialValues?.validUntil ?? "");
  const [discountTotal, setDiscountTotal] = useState(initialValues?.discountTotal ?? "0");
  const [surchargeTotal, setSurchargeTotal] = useState(initialValues?.surchargeTotal ?? "0");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [terms, setTerms] = useState(initialValues?.terms ?? "");
  const [barcodeMessage, setBarcodeMessage] = useState<{
    code: string;
    message: string;
    tone: "ok" | "error" | "info";
  } | null>(null);

  const subtotal = useMemo(
    () =>
      roundMoney(
        items.reduce(
          (sum, item) => sum + safeNumber(item.quantity) * safeNumber(item.unitPrice),
          0
        )
      ),
    [items]
  );
  const total = roundMoney(
    Math.max(subtotal - safeNumber(discountTotal) + safeNumber(surchargeTotal), 0)
  );
  const payload = useMemo(
    () =>
      JSON.stringify({
        customerId: selectedCustomer?.id ?? null,
        customerName: customerQuery,
        customerDocument: selectedCustomer?.document ?? manualDocument,
        customerPhone: selectedCustomer?.phone ?? manualPhone,
        customerEmail: selectedCustomer?.email ?? manualEmail,
        validUntil,
        notes,
        terms,
        discountTotal,
        surchargeTotal,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitType: item.unitType,
          notes: item.notes
        }))
      }),
    [
      customerQuery,
      discountTotal,
      items,
      manualDocument,
      manualEmail,
      manualPhone,
      notes,
      selectedCustomer,
      surchargeTotal,
      terms,
      validUntil
    ]
  );

  useBarcodeScanner({
    preventDefaultOnScan: true,
    onScan: handleBarcodeScan
  });

  function handleProductSearch(value: string) {
    setProductQuery(value);
    if (value.trim().length < 2) {
      setProductResults([]);
      return;
    }

    startSearchTransition(async () => {
      const result = await searchQuoteProductsAction(value);
      setProductResults(result.products);
    });
  }

  function handleProductKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const firstProduct = productResults[0];
    if (firstProduct) {
      addProduct(firstProduct);
    }
  }

  function handleCustomerSearch(value: string) {
    setCustomerQuery(value);
    setSelectedCustomer(null);
    if (value.trim().length < 2) {
      setCustomerResults([]);
      return;
    }

    startSearchTransition(async () => {
      const results = await searchQuoteCustomersAction(value);
      setCustomerResults(results);
    });
  }

  function handleBarcodeScan(code: string) {
    startSearchTransition(async () => {
      const result = await findQuoteProductByBarcodeAction(code);

      if (result.status === "found") {
        addProduct(result.product);
        setBarcodeMessage({
          code,
          message: `Producto agregado: ${result.product.name}.`,
          tone: "ok"
        });
        return;
      }

      const messageByStatus = {
        not_found: "No se encontro producto con ese codigo.",
        inactive: `El producto ${result.status === "inactive" ? result.productName : ""} esta inactivo.`,
        deleted: `El producto ${result.status === "deleted" ? result.productName : ""} esta eliminado.`
      };

      setBarcodeMessage({
        code,
        message: messageByStatus[result.status],
        tone: "error"
      });
    });
  }

  function addProduct(product: QuoteProductResult) {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: String(roundQuantity(safeNumber(item.quantity) + 1)) }
            : item
        );
      }

      return [
        ...current,
        {
          id: createDraftId(),
          productId: product.id,
          productName: product.name,
          quantity: "1",
          unitPrice: product.salePrice,
          unitType: product.unitType,
          notes: "",
          categoryName: product.categoryName
        }
      ];
    });
    setProductQuery("");
    setProductResults([]);
  }

  function updateItem(id: string, patch: Partial<QuoteItemDraft>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <form action={formAction} className="space-y-5 pb-20">
      <input type="hidden" name="payload" value={payload} />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <SectionTitle
              title="Cliente"
              description="Usa un cliente existente o completa datos manuales."
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Cliente / razon social">
                <Input
                  value={customerQuery}
                  onChange={(event) => handleCustomerSearch(event.target.value)}
                  placeholder="Buscar cliente o escribir nombre"
                  required
                />
                {customerResults.length > 0 ? (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery(customer.name);
                          setCustomerResults([]);
                        }}
                      >
                        <span className="font-semibold text-gray-950 dark:text-gray-50">
                          {customer.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-gray-400">
                          {[customer.document, customer.phone, customer.email]
                            .filter(Boolean)
                            .join(" - ") || "Sin datos adicionales"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </Field>
              <Field label="Documento">
                <Input
                  value={selectedCustomer?.document ?? manualDocument}
                  onChange={(event) => setManualDocument(event.target.value)}
                  placeholder="Se completa si elegis cliente"
                  disabled={Boolean(selectedCustomer)}
                />
              </Field>
              <Field label="Telefono">
                <Input
                  value={selectedCustomer?.phone ?? manualPhone}
                  onChange={(event) => setManualPhone(event.target.value)}
                  disabled={Boolean(selectedCustomer)}
                />
              </Field>
              <Field label="Email">
                <Input
                  value={selectedCustomer?.email ?? manualEmail}
                  onChange={(event) => setManualEmail(event.target.value)}
                  disabled={Boolean(selectedCustomer)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle
              title="Productos"
              description="Busca por nombre, SKU o codigo de barras. El scanner agrega automaticamente."
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Input
                value={productQuery}
                onChange={(event) => handleProductSearch(event.target.value)}
                onKeyDown={handleProductKeyDown}
                placeholder="Buscar o escanear producto"
                className="h-12 text-base"
              />
              <Button
                type="button"
                variant="primary"
                disabled={productResults.length === 0}
                onClick={() => productResults[0] && addProduct(productResults[0])}
              >
                Agregar
              </Button>
            </div>
            <div className="mt-3">
              <BarcodeFeedback
                code={barcodeMessage?.code ?? null}
                message={barcodeMessage?.message ?? null}
                tone={barcodeMessage?.tone}
              />
            </div>
            {productResults.length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {productResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm shadow-sm transition hover:border-brand-300 hover:bg-brand-50/60 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                    onClick={() => addProduct(product)}
                  >
                    <span className="block font-semibold text-gray-950 dark:text-gray-50">
                      {product.name}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-gray-400">
                      {product.categoryName} - {product.barcode ?? product.sku ?? "Sin codigo"}
                    </span>
                    <span className="mt-2 block font-bold text-brand-700 dark:text-brand-300">
                      {formatARS(product.salePrice)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Subtotal</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                        Agrega productos para guardar el presupuesto.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-950 dark:text-gray-50">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">
                            {item.categoryName ?? "Producto"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={item.quantity}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateItem(item.id, {
                                quantity: sanitizeDecimalInput(event.target.value, 3)
                              })
                            }
                            className="h-9 w-24"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={item.unitPrice}
                            inputMode="decimal"
                            onChange={(event) =>
                              updateItem(item.id, {
                                unitPrice: sanitizeDecimalInput(event.target.value, 2)
                              })
                            }
                            className="h-9 w-28"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-950 dark:text-gray-50">
                          {formatARS(safeNumber(item.quantity) * safeNumber(item.unitPrice))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-red-950/30"
                            aria-label="Quitar item"
                            onClick={() => removeItem(item.id)}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Notas">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                />
              </Field>
              <Field label="Condiciones">
                <Textarea
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  rows={4}
                  placeholder="Ej: precios validos hasta la fecha indicada."
                />
              </Field>
            </div>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="p-5">
            <SectionTitle title="Totales" description="No descuenta stock ni crea venta." />
            <div className="mt-4 space-y-3">
              <Field label="Valido hasta">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              </Field>
              <Field label="Descuento">
                <Input
                  value={discountTotal}
                  inputMode="decimal"
                  onChange={(event) =>
                    setDiscountTotal(sanitizeDecimalInput(event.target.value, 2))
                  }
                />
              </Field>
              <Field label="Recargo">
                <Input
                  value={surchargeTotal}
                  inputMode="decimal"
                  onChange={(event) =>
                    setSurchargeTotal(sanitizeDecimalInput(event.target.value, 2))
                  }
                />
              </Field>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <SummaryLine label="Subtotal" value={formatARS(subtotal)} />
              <SummaryLine label="Descuento" value={formatARS(safeNumber(discountTotal))} />
              <SummaryLine label="Recargo" value={formatARS(safeNumber(surchargeTotal))} />
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xl font-bold dark:border-neutral-800">
                <span>Total</span>
                <span>{formatARS(total)}</span>
              </div>
            </div>
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
              Presupuesto no valido como factura.
            </p>
          </Card>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-100/95 px-1 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <LinkButton href="/presupuestos" variant="ghost">
          Cancelar
        </LinkButton>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || isSearching || items.length === 0}
        >
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-gray-950 dark:text-gray-50">{value}</span>
    </div>
  );
}

function sanitizeDecimalInput(value: string, decimals: number) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const decimal = decimalParts.join("");
  return decimalParts.length > 0 ? `${whole}.${decimal.slice(0, decimals)}` : whole;
}

function safeNumber(value: string | number) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function createDraftId() {
  return globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
}
