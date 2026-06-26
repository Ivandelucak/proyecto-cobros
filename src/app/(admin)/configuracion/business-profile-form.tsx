"use client";

import { useActionState, useRef, useState } from "react";
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
    email: string | null;
    fiscalCondition: string | null;
    grossIncome: string | null;
    activityStartDate: Date | null;
    currency: string;
    locale: string;
    timezone: string;
    preferredTheme: string | null;
    logoUrl: string | null;
    website: string | null;
    generalFooterText: string | null;
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
  const [logoPreview, setLogoPreview] = useState(initialValues.logoUrl ?? "");
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(file: File | null) {
    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoPreview(initialValues.logoUrl ?? "");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(typeof reader.result === "string" ? reader.result : "");
      setRemoveLogo(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="logoUrl" value={initialValues.logoUrl ?? ""} />
      {removeLogo ? <input type="hidden" name="removeLogo" value="on" /> : null}
      <Card className="p-5">
        <SectionTitle
          title="Datos del comercio"
          description="Identidad principal del local dentro del sistema."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
          <Field label="Moneda">
            <Input name="currency" defaultValue={initialValues.currency} />
          </Field>
          <Field label="Locale">
            <Input name="locale" defaultValue={initialValues.locale} />
          </Field>
          <Field label="Zona horaria">
            <Input name="timezone" defaultValue={initialValues.timezone} />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Datos para ticket"
          description="Nombre, direccion y telefono se usan en los tickets impresos."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Telefono">
            <Input name="phone" defaultValue={initialValues.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={initialValues.email ?? ""} />
          </Field>
          <Field label="Direccion">
            <Input name="address" defaultValue={initialValues.address ?? ""} />
          </Field>
          <Field label="Condicion fiscal">
            <Input
              name="fiscalCondition"
              defaultValue={initialValues.fiscalCondition ?? ""}
            />
          </Field>
          <Field label="Ingresos brutos">
            <Input name="grossIncome" defaultValue={initialValues.grossIncome ?? ""} />
          </Field>
          <Field label="Inicio de actividades">
            <Input
              name="activityStartDate"
              type="date"
              defaultValue={dateInput(initialValues.activityStartDate)}
            />
          </Field>
          <Field label="Sitio web">
            <Input name="website" defaultValue={initialValues.website ?? ""} />
          </Field>
          <Field label="Texto pie general">
            <Input
              name="generalFooterText"
              defaultValue={initialValues.generalFooterText ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Preferencias visuales"
          description="Ajustes livianos de apariencia y logo usado en impresiones."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Field label="Tema preferido">
            <Select name="preferredTheme" defaultValue={initialValues.preferredTheme ?? ""}>
              <option value="">Sin preferencia</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </Select>
          </Field>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Logo del comercio
            </p>
            <div className="mt-3 grid min-h-28 place-items-center rounded-md border border-dashed border-slate-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
              {logoPreview && !removeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Logo del comercio"
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <span className="text-center text-xs text-slate-500 dark:text-gray-400">
                  Sin logo cargado
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="logoFile"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Reemplazar logo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setRemoveLogo(true);
                  setLogoPreview("");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Quitar
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-gray-400">
              PNG, JPG o WebP. Maximo 1.5 MB.
            </p>
          </div>
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
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar datos"}
        </Button>
      </div>
    </form>
  );
}

function dateInput(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-");
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
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
