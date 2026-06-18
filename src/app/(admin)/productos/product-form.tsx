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
  const isNewProduct = !initialValues;

  function handleUnitChange(value: string) {
    setUnitType(value);
    if (decimalSuggestedUnits.has(value)) {
      setAllowsDecimal(true);
    }
  }

  return (
    <form action={formAction} className="space-y-5 pb-20">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      <Card className="p-5">
        <SectionTitle
          title="Informacion basica"
          description="Datos para identificar el producto en caja, busqueda y listados."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={initialValues?.name ?? ""} required />
          </Field>
          <Field label="Categoria">
            <Select name="categoryId" defaultValue={initialValues?.categoryId ?? ""} required>
              <option value="">Seleccionar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Codigo de barras">
            <Input
              name="barcode"
              defaultValue={initialValues?.barcode ?? ""}
              placeholder="Escanea o pega el codigo"
              className="h-12 text-base"
            />
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
        <SectionTitle
          title="Precio y stock"
          description="Importes y cantidades operativas. Los cambios de stock quedan auditados."
        />
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
          <Field label="Stock minimo">
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
        <SectionTitle
          title="Configuracion de venta"
          description="Define como se vende en caja y como aparece para el cajero."
        />
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

          <CheckCard
            name="allowsDecimalQuantity"
            checked={allowsDecimal}
            onChange={setAllowsDecimal}
            title="Permite cantidad decimal"
            description="Se activa automaticamente para kg, gr, litro o metro."
          />
          <CheckCard
            name="active"
            defaultChecked={initialValues?.active ?? true}
            title="Activo"
            description="Disponible para vender y buscar en caja."
          />
          <CheckCard
            name="quickAccess"
            defaultChecked={initialValues?.quickAccess ?? false}
            title="Acceso rapido en caja"
            description="Aparece entre los productos rapidos del POS."
          />
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-100/95 px-1 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <LinkButton href="/productos" variant="ghost">
          Cancelar
        </LinkButton>
        {isNewProduct ? (
          <Button
            type="submit"
            name="submitIntent"
            value="createAnother"
            disabled={pending}
          >
            {pending ? "Guardando..." : "Guardar y cargar otro"}
          </Button>
        ) : null}
        <Button
          type="submit"
          name="submitIntent"
          value="save"
          variant="primary"
          disabled={pending}
        >
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SectionTitle({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </div>
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

function CheckCard({
  name,
  title,
  description,
  checked,
  defaultChecked,
  onChange
}: {
  name: string;
  title: string;
  description: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-600"
      />
      <span>
        <span className="block font-medium text-gray-950 dark:text-gray-50">{title}</span>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {description}
        </span>
      </span>
    </label>
  );
}
