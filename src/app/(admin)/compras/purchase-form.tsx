"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { formatARS } from "@/lib/money";
import type { PurchaseFormState } from "./actions";

type ProductOption = {
  id: string;
  name: string;
  cost: string;
  stock: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

type Row = {
  localId: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

const initialState: PurchaseFormState = {};

export function PurchaseForm({
  action,
  products,
  suppliers
}: {
  action: (state: PurchaseFormState, formData: FormData) => Promise<PurchaseFormState>;
  products: ProductOption[];
  suppliers: SupplierOption[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [rows, setRows] = useState<Row[]>([createRow(products[0], "row-1")]);
  const total = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + safeNumber(row.quantity) * safeNumber(row.unitCost),
        0
      ),
    [rows]
  );

  function updateRow(localId: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => {
        if (row.localId !== localId) {
          return row;
        }

        const next = { ...row, ...patch };
        if (patch.productId) {
          const product = products.find((item) => item.id === patch.productId);
          next.unitCost = product?.cost || "0";
        }
        return next;
      })
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Proveedor
            </span>
            <Select name="supplierId" defaultValue="">
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Observacion
            </span>
            <Input name="notes" placeholder="Opcional" />
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Productos
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Costo unitario</th>
                <th className="px-4 py-3 font-medium">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {rows.map((row) => (
                <tr key={row.localId}>
                  <td className="px-4 py-3">
                    <Select
                      value={row.productId}
                      onChange={(event) =>
                        updateRow(row.localId, { productId: event.target.value })
                      }
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={row.quantity}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateRow(row.localId, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={row.unitCost}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateRow(row.localId, { unitCost: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                    {formatARS(safeNumber(row.quantity) * safeNumber(row.unitCost))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rows.length === 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.localId !== row.localId)
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-neutral-800">
          <Button
            type="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                createRow(products[0], `row-${current.length + 1}-${Date.now()}`)
              ])
            }
          >
            Agregar producto
          </Button>
          <p className="text-lg font-semibold text-gray-950 dark:text-gray-50">
            Total {formatARS(total)}
          </p>
        </div>
      </Card>

      <textarea name="rowsJson" readOnly hidden value={JSON.stringify(rows)} />
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || products.length === 0}>
          {pending ? "Registrando..." : "Confirmar compra"}
        </Button>
      </div>
    </form>
  );
}

function createRow(product?: ProductOption, localId = "row"): Row {
  return {
    localId,
    productId: product?.id ?? "",
    quantity: "1",
    unitCost: product?.cost || "0"
  };
}

function safeNumber(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
