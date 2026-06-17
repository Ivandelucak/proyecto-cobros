"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  updateBusinessProfileAction,
  type BusinessProfileState
} from "./actions";

type BusinessTypeValue =
  | "KIOSK"
  | "GROCERY"
  | "SUPERMARKET"
  | "BUTCHER"
  | "GREENGROCER"
  | "BEVERAGE_STORE"
  | "HARDWARE_STORE"
  | "PET_SHOP"
  | "BOOKSTORE"
  | "CLOTHING_STORE"
  | "BAZAAR"
  | "OTHER";

type BusinessProfileFormProps = {
  initialValues: {
    name: string;
    businessType: BusinessTypeValue;
    cuit: string | null;
    address: string | null;
    phone: string | null;
    currency: string;
    preferredTheme: string | null;
    logoUrl: string | null;
  };
};

const businessTypeLabels: Record<BusinessTypeValue, string> = {
  KIOSK: "Kiosco",
  GROCERY: "Almacen",
  SUPERMARKET: "Supermercado",
  BUTCHER: "Carniceria",
  GREENGROCER: "Verduleria",
  BEVERAGE_STORE: "Bebidas",
  HARDWARE_STORE: "Ferreteria",
  PET_SHOP: "Pet shop",
  BOOKSTORE: "Libreria",
  CLOTHING_STORE: "Indumentaria",
  BAZAAR: "Bazar",
  OTHER: "Otro"
};

const initialState: BusinessProfileState = {};

export function BusinessProfileForm({ initialValues }: BusinessProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateBusinessProfileAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre del comercio">
            <Input name="name" defaultValue={initialValues.name} required />
          </Field>
          <Field label="Rubro">
            <Select name="businessType" defaultValue={initialValues.businessType}>
              {Object.entries(businessTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CUIT">
            <Input name="cuit" defaultValue={initialValues.cuit ?? ""} />
          </Field>
          <Field label="Telefono">
            <Input name="phone" defaultValue={initialValues.phone ?? ""} />
          </Field>
          <Field label="Direccion">
            <Input name="address" defaultValue={initialValues.address ?? ""} />
          </Field>
          <Field label="Moneda">
            <Input name="currency" defaultValue={initialValues.currency} />
          </Field>
          <Field label="Tema preferido">
            <Select name="preferredTheme" defaultValue={initialValues.preferredTheme ?? ""}>
              <option value="">Sin preferencia</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </Select>
          </Field>
          <Field label="Logo URL">
            <Input name="logoUrl" defaultValue={initialValues.logoUrl ?? ""} />
          </Field>
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

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Guardando..." : "Guardar configuracion"}
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
