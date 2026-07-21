"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getFiscalConnectionStatus } from "@/lib/fiscal/fiscal-connection-status";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import {
  updateFiscalSettingsAction,
  verifyArcaConnectionAction,
  type ArcaTestState,
  type FiscalSettingsState
} from "./actions";

type FiscalSettingsFormProps = {
  setting: FiscalSettingView;
};

const initialState: FiscalSettingsState = {};
const initialVerificationState: ArcaTestState = {};
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
  ["", "Sin definir"],
  ["TAXED_21", "Gravado 21%"],
  ["TAXED_10_5", "Gravado 10.5%"],
  ["TAXED_27", "Gravado 27%"],
  ["TAXED_0", "Gravado 0%"],
  ["EXEMPT", "Exento"],
  ["NON_TAXABLE", "No gravado"]
] as const;

export function FiscalSettingsForm({ setting }: FiscalSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateFiscalSettingsAction,
    initialState
  );
  const [verificationState, verificationAction, verificationPending] = useActionState(
    verifyArcaConnectionAction,
    initialVerificationState
  );
  const [connectionSetupOpen, setConnectionSetupOpen] = useState(false);
  const connectionStatus = getFiscalConnectionStatus(setting);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="environment" value={setting.environment} />
      <Card className="p-4">
        <SectionTitle title="Activacion" />
        <div className="mt-3 max-w-md">
          <Toggle
            name="enabled"
            label="Habilitar facturacion electronica"
            value={setting.enabled}
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Datos fiscales del emisor" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Configuracion fiscal" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        </div>
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
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        <details className="mt-4 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
            Ajustes de alertas
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
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
          </div>
        </details>
      </Card>

      <Card className="p-5">
        <ConnectionCard
          setting={setting}
          status={connectionStatus}
          setupOpen={connectionSetupOpen}
          onConfigure={() => setConnectionSetupOpen((open) => !open)}
          verificationAction={verificationAction}
          verificationPending={verificationPending}
          verificationState={verificationState}
        />
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

function ConnectionCard({
  setting,
  status,
  setupOpen,
  onConfigure,
  verificationAction,
  verificationPending,
  verificationState
}: {
  setting: FiscalSettingView;
  status: ReturnType<typeof getFiscalConnectionStatus>;
  setupOpen: boolean;
  onConfigure: () => void;
  verificationAction: (payload: FormData) => void;
  verificationPending: boolean;
  verificationState: ArcaTestState;
}) {
  const canVerify = Boolean(
    setting.cuit &&
      setting.hasArcaCertificatePem &&
      setting.hasArcaPrivateKeyPem
  );

  return (
    <>
      <SectionTitle title="Conexion con ARCA" />
      <div className="mt-4 rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {status.label}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Configura los datos necesarios para emitir comprobantes electronicos.
            </p>
          </div>
          <ConnectionBadge tone={status.tone}>{status.label}</ConnectionBadge>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <ConnectionInfo label="CUIT" value={setting.cuit ?? "Sin cargar"} />
          <ConnectionInfo
            label="Punto de venta"
            value={setting.pointOfSale ? String(setting.pointOfSale) : "Sin cargar"}
          />
          <ConnectionInfo
            label="Certificado"
            value={certificateLabel(setting)}
          />
        </dl>

        {status.missing.length > 0 ? (
          <div className="mt-4 border-t border-[color:var(--panel-border)] pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Faltan completar
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-secondary)]">
              {status.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onConfigure}>
            {setupOpen ? "Cerrar configuracion" : "Configurar conexion"}
          </Button>
          <Button
            type="submit"
            variant="primary"
            formAction={verificationAction}
            disabled={!canVerify || verificationPending}
          >
            {verificationPending ? "Verificando..." : "Verificar conexion"}
          </Button>
        </div>
        {!canVerify ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Completa el CUIT y carga las credenciales para verificar la conexion.
          </p>
        ) : null}
        <ConnectionMessage state={verificationState} />
      </div>

      {setupOpen ? (
        <div className="mt-4 rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Configurar conexion con ARCA
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Estas credenciales permiten que Fox Point solicite autorizacion de comprobantes a ARCA.
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            El certificado y la clave privada son archivos de conexion distintos del CUIT.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Certificado de conexion (PEM)">
              <Textarea
                name="arcaCertificatePem"
                rows={7}
                spellCheck={false}
                placeholder="Pega el certificado para reemplazarlo"
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Clave privada (PEM)">
              <Textarea
                name="arcaPrivateKeyPem"
                rows={7}
                spellCheck={false}
                placeholder="Pega la clave privada para reemplazarla"
                className="font-mono text-xs"
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Guarda la configuracion antes de verificar la conexion. Las credenciales no se vuelven a mostrar despues de guardarlas.
          </p>
        </div>
      ) : null}
    </>
  );
}

function ConnectionBadge({
  tone,
  children
}: {
  tone: ReturnType<typeof getFiscalConnectionStatus>["tone"];
  children: React.ReactNode;
}) {
  const classes = {
    neutral: "badge-neutral",
    warning: "badge-warning",
    success: "badge-success",
    danger: "badge-danger"
  };

  return <span className={`badge ${classes[tone]}`}>{children}</span>;
}

function ConnectionInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function ConnectionMessage({ state }: { state: ArcaTestState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={
        state.error
          ? "mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "mt-3 rounded-md border border-[#BFE3D2] bg-[#E8F6EF] px-3 py-2 text-sm text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}

function certificateLabel(setting: FiscalSettingView) {
  if (!setting.hasArcaCertificatePem) {
    return "Sin cargar";
  }

  if (!setting.arcaCertificateExpiresAt) {
    return "Cargado";
  }

  const date = new Date(setting.arcaCertificateExpiresAt);
  if (Number.isNaN(date.getTime())) {
    return "Cargado";
  }

  const formatted = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  return setting.arcaCertificateIsExpired
    ? `Vencido el ${formatted}`
    : `Vence el ${formatted}`;
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
