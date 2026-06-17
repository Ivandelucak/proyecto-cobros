"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import type { ProductFormState } from "./actions";

type CategoryOption = {
  id: string;
  name: string;
};

type ProductFormValues = {
  name?: string;
  barcode?: string | null;
  sku?: string | null;
  brand?: string | null;
  categoryId?: string;
  salePrice?: string;
  cost?: string | null;
  stock?: string;
  minStock?: string;
  unitType?: string;
  allowsDecimalQuantity?: boolean;
  quickAccess?: boolean;
  active?: boolean;
};

type ProductFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  categories: CategoryOption[];
  initialValues?: ProductFormValues;
  submitLabel: string;
};

const initialState: ProductFormState = {};

const units = [
  ["UNIT", "Unidad"],
  ["KG", "Kilogramo"],
  ["GR", "Gramo"],
  ["LITER", "Litro"],
  ["METER", "Metro"],
  ["PACK", "Pack"],
  ["BOX", "Caja"],
  ["OTHER", "Otro"]
];

const decimalSuggestedUnits = new Set(["KG", "GR", "LITER", "METER"]);

export function ProductForm({
  action,
  categories,
  initialValues,
  submitLabel
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [unitType, setUnitType] = useState(initialValues?.unitType ?? "UNIT");
  const [allowsDecimal, setAllowsDecimal] = useState(
    Boolean(initialValues?.allowsDecimalQuantity)
  );

  function handleUnitChange(value: string) {
    setUnitType(value);
    if (decimalSuggestedUnits.has(value)) {
      setAllowsDecimal(true);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
          Información básica
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={initialValues?.name ?? ""} required />
          </Field>
          <Field label="Categoría">
            <Select name="categoryId" defaultValue={initialValues?.categoryId ?? ""} required>
              <option value="">Seleccionar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Código de barras">
            <Input name="barcode" defaultValue={initialValues?.barcode ?? ""} />
          </Field>
          <Field label="SKU">
            <Input name="sku" defaultValue={initialValues?.sku ?? ""} />
          </Field>
          <Field label="Marca">
            <Input name="brand" defaultValue={initialValues?.brand ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
          Precio y stock
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Precio de venta">
            <Input
              name="salePrice"
              inputMode="decimal"
              defaultValue={initialValues?.salePrice ?? "0"}
              required
            />
          </Field>
          <Field label="Costo">
            <Input name="cost" inputMode="decimal" defaultValue={initialValues?.cost ?? ""} />
          </Field>
          <Field label="Stock">
            <Input
              name="stock"
              inputMode="decimal"
              defaultValue={initialValues?.stock ?? "0"}
              required
            />
          </Field>
          <Field label="Stock mínimo">
            <Input
              name="minStock"
              inputMode="decimal"
              defaultValue={initialValues?.minStock ?? "0"}
              required
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
          Configuración de venta
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Unidad">
            <Select
              name="unitType"
              value={unitType}
              onChange={(event) => handleUnitChange(event.target.value)}
            >
              {units.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
              <input
                type="checkbox"
                name="allowsDecimalQuantity"
                checked={allowsDecimal}
                onChange={(event) => setAllowsDecimal(event.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Permite cantidad decimal
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
              <input
                type="checkbox"
                name="active"
                defaultChecked={initialValues?.active ?? true}
                className="h-4 w-4 accent-brand-600"
              />
              Activo
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
              <input
                type="checkbox"
                name="quickAccess"
                defaultChecked={initialValues?.quickAccess ?? false}
                className="h-4 w-4 accent-brand-600"
              />
              Acceso rápido en caja
            </label>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <LinkButton href="/productos">Cancelar</LinkButton>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}
