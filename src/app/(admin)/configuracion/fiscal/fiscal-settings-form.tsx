"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import {
  updateFiscalSettingsAction,
  type FiscalSettingsState
} from "./actions";

type FiscalSettingsFormProps = {
  setting: FiscalSettingView;
};

const initialState: FiscalSettingsState = {};
const environmentLabels = {
  HOMOLOGACION: "Homologacion",
  PRODUCCION: "Produccion"
};
const issueModeLabels = {
  ASK: "Preguntar",
  AUTO: "Automatico",
  NEVER: "Nunca"
};
const fiscalConditionLabels = {
  "": "Sin especificar",
  CONSUMIDOR_FINAL: "Consumidor final",
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  NO_RESPONSABLE: "No responsable",
  EXTERIOR: "Exterior",
  OTHER: "Otro"
};
const letterLabels = {
  "": "Sin definir",
  A: "A",
  B: "B",
  C: "C",
  M: "M",
  E: "E"
};
const identityTypeLabels = {
  DNI: "DNI",
  CUIT: "CUIT",
  CUIL: "CUIL",
  CDI: "CDI",
  PASAPORTE: "Pasaporte",
  CONSUMIDOR_FINAL: "Consumidor final",
  OTHER: "Otro"
};
const fiscalTaxOptions = [
  ["", "Sin definir", "La pre-emision pedira configurar tratamiento fiscal."],
  ["TAXED_21", "Gravado 21%", "Codigo ARCA 5"],
  ["TAXED_10_5", "Gravado 10.5%", "Codigo ARCA 4"],
  ["TAXED_27", "Gravado 27%", "Codigo ARCA 6"],
  ["TAXED_0", "Gravado 0%", "Codigo ARCA 3"],
  ["EXEMPT", "Exento", "Suma en importe exento"],
  ["NON_TAXABLE", "No gravado", "Suma en importe no gravado"]
] as const;

export function FiscalSettingsForm({ setting }: FiscalSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateFiscalSettingsAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <Card className="border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
        Esta etapa solo prepara la conexion de homologacion. No emite comprobantes
        reales en ARCA.
      </Card>

      <Card className="p-5">
        <SectionTitle title="Datos fiscales del emisor" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Toggle
            name="enabled"
            label="Habilitar preparacion fiscal"
            value={setting.enabled}
          />
          <Field label="Ambiente">
            <Select name="environment" defaultValue={setting.environment}>
              {Object.entries(environmentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CUIT emisor">
            <Input name="cuit" defaultValue={setting.cuit ?? ""} />
          </Field>
          <Field label="Razon social">
            <Input name="legalName" defaultValue={setting.legalName ?? ""} />
          </Field>
          <Field label="Condicion fiscal comercio">
            <Select
              name="fiscalCondition"
              defaultValue={setting.fiscalCondition ?? ""}
            >
              {Object.entries(fiscalConditionLabels).map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Punto de venta">
            <Input
              name="pointOfSale"
              type="number"
              min={1}
              max={99999}
              defaultValue={setting.pointOfSale ?? ""}
            />
          </Field>
          <Field label="Letra por defecto">
            <Select
              name="defaultInvoiceLetter"
              defaultValue={setting.defaultInvoiceLetter ?? ""}
            >
              {Object.entries(letterLabels).map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Documento consumidor final">
            <Select
              name="defaultCustomerDocType"
              defaultValue={setting.defaultCustomerDocType}
            >
              {Object.entries(identityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="IVA por defecto" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Tratamiento y alicuota por defecto">
            <Select
              name="defaultFiscalTax"
              defaultValue={defaultFiscalTaxValue(setting)}
            >
              {fiscalTaxOptions.map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-[#273342] dark:bg-[#121922]">
            <span className="block text-xs uppercase tracking-wide text-gray-500 dark:text-[#7F8D9A]">
              Codigo ARCA asociado
            </span>
            <span className="mt-1 block font-semibold text-gray-950 dark:text-[#F3F7FA]">
              {defaultFiscalTaxHelp(defaultFiscalTaxValue(setting))}
            </span>
          </div>
        </div>
        {setting.fiscalCondition === "MONOTRIBUTO" ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-[#7F8D9A]">
            En Factura C no se discrimina IVA. La previsualizacion conserva el
            total como importe neto interno.
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <SectionTitle title="Politica de emision" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Efectivo">
            <IssueModeSelect name="cashIssueMode" value={setting.cashIssueMode} />
          </Field>
          <Field label="Medios electronicos">
            <IssueModeSelect
              name="electronicPaymentIssueMode"
              value={setting.electronicPaymentIssueMode}
            />
          </Field>
          <Field label="Cuenta corriente">
            <IssueModeSelect
              name="currentAccountIssueMode"
              value={setting.currentAccountIssueMode}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Pendientes y anulaciones" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Minutos para advertencia">
            <Input
              name="pendingWarningMinutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={setting.pendingWarningMinutes}
            />
          </Field>
          <Field label="Minutos para alerta critica">
            <Input
              name="pendingCriticalMinutes"
              type="number"
              min={1}
              max={1440}
              defaultValue={setting.pendingCriticalMinutes}
            />
          </Field>
          <Toggle
            name="allowCancelBeforeIssue"
            label="Permitir anular antes de emitir"
            value={setting.allowCancelBeforeIssue}
          />
          <Toggle
            name="requireCustomerForInvoiceA"
            label="Requerir cliente para factura A"
            value={setting.requireCustomerForInvoiceA}
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Credenciales ARCA homologacion" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CredentialStatus
            label="Certificado cargado"
            value={setting.hasArcaCertificatePem}
          />
          <CredentialStatus
            label="Clave privada cargada"
            value={setting.hasArcaPrivateKeyPem}
          />
          <Field label="Certificado PEM">
            <Textarea
              name="arcaCertificatePem"
              rows={7}
              spellCheck={false}
              placeholder="Pegar nuevo certificado PEM para reemplazar"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Clave privada PEM">
            <Textarea
              name="arcaPrivateKeyPem"
              rows={7}
              spellCheck={false}
              placeholder="Pegar nueva clave privada PEM para reemplazar"
              className="font-mono text-xs"
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-[#7F8D9A]">
          Las credenciales se guardan para pruebas locales de homologacion y no se
          vuelven a mostrar despues de guardar.
        </p>
      </Card>

      <StateMessage state={state} />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar fiscal"}
        </Button>
      </div>
    </form>
  );
}

function IssueModeSelect({ name, value }: { name: string; value: string }) {
  return (
    <Select name={name} defaultValue={value}>
      {Object.entries(issueModeLabels).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </Select>
  );
}

function defaultFiscalTaxValue(setting: FiscalSettingView) {
  if (!setting.defaultTaxTreatment) {
    return "";
  }

  if (setting.defaultTaxTreatment === "EXEMPT") {
    return "EXEMPT";
  }

  if (setting.defaultTaxTreatment === "NON_TAXABLE") {
    return "NON_TAXABLE";
  }

  if (setting.defaultVatRate === "10.5") {
    return "TAXED_10_5";
  }
  if (setting.defaultVatRate === "27") {
    return "TAXED_27";
  }
  if (setting.defaultVatRate === "0") {
    return "TAXED_0";
  }

  return "TAXED_21";
}

function defaultFiscalTaxHelp(value: string) {
  const option = fiscalTaxOptions.find(([optionValue]) => optionValue === value);
  return option?.[2] ?? "Sin codigo";
}

function Toggle({ name, label, value }: { name: string; label: string; value: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-[#273342] dark:bg-[#121922]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={value}
        className="h-4 w-4 rounded border-slate-300 text-brand-600"
      />
      <span className="font-medium text-gray-800 dark:text-[#F3F7FA]">{label}</span>
    </label>
  );
}

function CredentialStatus({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-[#273342] dark:bg-[#121922]">
      <span className="block text-xs uppercase tracking-wide text-gray-500 dark:text-[#7F8D9A]">
        {label}
      </span>
      <span className="mt-1 block font-semibold text-gray-950 dark:text-[#F3F7FA]">
        {value ? "Si" : "No"}
      </span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">{title}</h2>;
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
      <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">{label}</span>
      {children}
    </label>
  );
}

function StateMessage({ state }: { state: FiscalSettingsState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={
        state.error
          ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "rounded-md border border-[#BFE3D2] bg-[#E8F6EF] px-3 py-2 text-sm text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}
