"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  SettingsAlert,
  SettingsCard,
  SettingsField,
  SettingsGrid,
  SettingsSaveBar,
  SettingsSection
} from "@/components/ui/settings";
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
const MAX_LOGO_BYTES = 1_500_000;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function BusinessProfileForm({ initialValues }: BusinessProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateBusinessProfileAction,
    initialState
  );
  const [logoPreview, setLogoPreview] = useState(initialValues.logoUrl ?? "");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visibleLogo = Boolean(logoPreview) && !removeLogo;
  const logoStatus = visibleLogo
    ? logoPreview.startsWith("data:image/")
      ? "Vista previa sin guardar"
      : "Imagen cargada"
    : "Sin imagen cargada";
  const logoDetail = visibleLogo
    ? logoPreview.startsWith("data:image/")
      ? "Se guardara al confirmar los cambios."
      : logoPreview.split("/").pop() ?? "Logo del comercio"
    : "Subi un logo para tickets, presupuestos e interfaz.";

  function handleLogoChange(file: File | null) {
    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoPreview(initialValues.logoUrl ?? "");
      setLogoError("Formato no permitido. Usa PNG, JPG o WebP.");
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setLogoPreview(initialValues.logoUrl ?? "");
      setLogoError("El logo supera el maximo permitido de 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(typeof reader.result === "string" ? reader.result : "");
      setRemoveLogo(false);
      setLogoError(null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="logoUrl" value={initialValues.logoUrl ?? ""} />
      {removeLogo ? <input type="hidden" name="removeLogo" value="on" /> : null}
      <SettingsCard>
        <SettingsSection
          title="Datos del comercio"
          description="Identidad principal del local dentro del sistema."
        >
        <SettingsGrid>
          <SettingsField label="Nombre del comercio">
            <Input name="name" defaultValue={initialValues.name} required />
          </SettingsField>
          <SettingsField label="Rubro">
            <Select name="businessType" defaultValue={initialValues.businessType}>
              {Object.entries(businessTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </SettingsField>
          <SettingsField label="CUIT">
            <Input name="cuit" defaultValue={initialValues.cuit ?? ""} />
          </SettingsField>
          <SettingsField label="Moneda">
            <Input name="currency" defaultValue={initialValues.currency} />
          </SettingsField>
          <SettingsField label="Locale">
            <Input name="locale" defaultValue={initialValues.locale} />
          </SettingsField>
          <SettingsField label="Zona horaria">
            <Input name="timezone" defaultValue={initialValues.timezone} />
          </SettingsField>
        </SettingsGrid>
        </SettingsSection>
      </SettingsCard>

      <SettingsCard>
        <SettingsSection
          title="Datos para ticket"
          description="Nombre, direccion y telefono se usan en los tickets impresos."
        >
        <SettingsGrid>
          <SettingsField label="Telefono">
            <Input name="phone" defaultValue={initialValues.phone ?? ""} />
          </SettingsField>
          <SettingsField label="Email">
            <Input name="email" type="email" defaultValue={initialValues.email ?? ""} />
          </SettingsField>
          <SettingsField label="Direccion">
            <Input name="address" defaultValue={initialValues.address ?? ""} />
          </SettingsField>
          <SettingsField label="Condicion fiscal">
            <Input
              name="fiscalCondition"
              defaultValue={initialValues.fiscalCondition ?? ""}
            />
          </SettingsField>
          <SettingsField label="Ingresos brutos">
            <Input name="grossIncome" defaultValue={initialValues.grossIncome ?? ""} />
          </SettingsField>
          <SettingsField label="Inicio de actividades">
            <Input
              name="activityStartDate"
              type="date"
              defaultValue={dateInput(initialValues.activityStartDate)}
            />
          </SettingsField>
          <SettingsField label="Sitio web">
            <Input name="website" defaultValue={initialValues.website ?? ""} />
          </SettingsField>
          <SettingsField label="Texto pie general">
            <Input
              name="generalFooterText"
              defaultValue={initialValues.generalFooterText ?? ""}
            />
          </SettingsField>
        </SettingsGrid>
        </SettingsSection>
      </SettingsCard>

      <SettingsSection
        title="Preferencias visuales"
        description="Ajustes livianos de apariencia y logo usado en impresiones."
      >
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,360px)_minmax(280px,420px)]">
          <div className="app-panel-secondary rounded-lg p-4">
            <p className="text-sm font-black text-[var(--text-primary)]">Tema</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Apariencia predeterminada del sistema.
            </p>
            <SettingsField label="Tema preferido" className="mt-4">
              <Select name="preferredTheme" defaultValue={initialValues.preferredTheme ?? ""}>
                <option value="">Sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </Select>
            </SettingsField>
          </div>

          <div className="app-panel-secondary rounded-lg p-4">
            <p className="text-sm font-black text-[var(--text-primary)]">
              Imagen del comercio
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Se usa en el encabezado, tickets y piezas visuales del sistema.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid h-[120px] w-full max-w-[240px] place-items-center rounded-md border border-dashed border-[color:var(--panel-border-strong)] bg-[var(--panel-bg)] p-3">
                {visibleLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Imagen del comercio"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-center text-xs font-semibold text-[var(--text-muted)]">
                    Sin imagen cargada
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">{logoStatus}</p>
                <p className="mt-1 truncate text-xs leading-5 text-[var(--text-muted)]" title={logoDetail}>
                  {logoDetail}
                </p>
              </div>
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
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                  Subir/Reemplazar imagen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setRemoveLogo(true);
                  setLogoPreview("");
                  setLogoError(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Quitar
              </Button>
            </div>
            {logoError ? (
              <p className="mt-2 text-xs leading-5 text-[var(--danger)]">{logoError}</p>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              PNG, JPG o WebP. Maximo 1.5 MB.
            </p>
          </div>
        </div>
      </SettingsSection>

      {state.error ? (
        <SettingsAlert tone="danger">{state.error}</SettingsAlert>
      ) : null}
      {state.success ? (
        <SettingsAlert tone="success">{state.success}</SettingsAlert>
      ) : null}

      <SettingsSaveBar message="Guarda identidad, datos fiscales y logo del comercio.">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar datos del comercio"}
        </Button>
      </SettingsSaveBar>
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
