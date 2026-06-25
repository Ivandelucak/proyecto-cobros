"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import {
  queryLastArcaVoucherAction,
  testArcaWsaaAction,
  testArcaWsfeStatusAction,
  type ArcaTestState
} from "./actions";

type VoucherTypeOption = {
  code: number;
  label: string;
};

type ArcaStatusPanelProps = {
  setting: FiscalSettingView;
  voucherTypeOptions: VoucherTypeOption[];
};

const initialState: ArcaTestState = {};

export function ArcaStatusPanel({
  setting,
  voucherTypeOptions
}: ArcaStatusPanelProps) {
  const [wsaaState, wsaaAction, wsaaPending] = useActionState(
    testArcaWsaaAction,
    initialState
  );
  const [wsfeState, wsfeAction, wsfePending] = useActionState(
    testArcaWsfeStatusAction,
    initialState
  );
  const [voucherState, voucherAction, voucherPending] = useActionState(
    queryLastArcaVoucherAction,
    initialState
  );
  const isHomologacion = setting.environment === "HOMOLOGACION";
  const connectionStatus = setting.arcaTokenIsValid
    ? "OK"
    : setting.arcaLastConnectionStatus ?? setting.arcaLastWsfeStatus;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Conexion ARCA homologacion
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Pruebas tecnicas sin emision de comprobantes ni solicitud de CAE.
          </p>
        </div>
        <StatusPill status={connectionStatus} />
      </div>

      {!isHomologacion ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          Esta etapa solo permite homologacion. Las acciones ARCA se bloquearan
          si el ambiente esta en produccion.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Ambiente" value={setting.environment} />
        <DetailItem label="CUIT" value={setting.cuit ?? "Sin cargar"} />
        <DetailItem
          label="Condicion fiscal"
          value={conditionLabel(setting.fiscalCondition)}
        />
        <DetailItem
          label="Punto de venta"
          value={setting.pointOfSale ? String(setting.pointOfSale) : "Sin cargar"}
        />
        <DetailItem label="IVA por defecto" value={defaultVatLabel(setting)} />
        <DetailItem
          label="Token vence"
          value={formatDateTime(setting.arcaTokenExpiresAt)}
        />
        <DetailItem
          label="Certificado"
          value={setting.hasArcaCertificatePem ? "Cargado" : "No cargado"}
        />
        <DetailItem
          label="Clave privada"
          value={setting.hasArcaPrivateKeyPem ? "Cargada" : "No cargada"}
        />
        <DetailItem
          label="Ultima prueba WSAA"
          value={formatStatusDate(
            setting.arcaLastConnectionStatus,
            setting.arcaLastConnectionTestAt
          )}
        />
        <DetailItem
          label="Ultima prueba WSFE"
          value={formatStatusDate(setting.arcaLastWsfeStatus, setting.arcaLastWsfeTestAt)}
        />
      </div>

      {setting.arcaLastError && !setting.arcaTokenIsValid ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
          {setting.arcaLastError}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <ActionBox
          title="WSAA"
          description="Obtiene token/sign de homologacion para wsfe."
          action={wsaaAction}
          pending={wsaaPending}
          buttonLabel="Probar conexion WSAA"
          pendingLabel="Probando..."
          state={wsaaState}
        />
        <ActionBox
          title="WSFEv1"
          description="Consulta estado y parametros basicos del servicio."
          action={wsfeAction}
          pending={wsfePending}
          buttonLabel="Consultar estado WSFEv1"
          pendingLabel="Consultando..."
          state={wsfeState}
        />
        <div className="rounded-lg border border-slate-200 p-4 dark:border-neutral-800">
          <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Ultimo comprobante
          </h3>
          <p className="mt-1 min-h-10 text-sm text-gray-600 dark:text-gray-300">
            Consulta el ultimo numero autorizado para punto de venta y tipo.
          </p>
          <form action={voucherAction} className="mt-4 space-y-3">
            <Select name="voucherType" defaultValue="6">
              {voucherTypeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={voucherPending}
            >
              {voucherPending ? "Consultando..." : "Consultar ultimo comprobante"}
            </Button>
          </form>
          <ActionResult state={voucherState} />
        </div>
      </div>
    </Card>
  );
}

function ActionBox({
  title,
  description,
  action,
  pending,
  buttonLabel,
  pendingLabel,
  state
}: {
  title: string;
  description: string;
  action: (payload: FormData) => void;
  pending: boolean;
  buttonLabel: string;
  pendingLabel: string;
  state: ArcaTestState;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h3>
      <p className="mt-1 min-h-10 text-sm text-gray-600 dark:text-gray-300">
        {description}
      </p>
      <form action={action} className="mt-4">
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? pendingLabel : buttonLabel}
        </Button>
      </form>
      <ActionResult state={state} />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="mt-1 block break-words text-sm font-semibold text-gray-950 dark:text-gray-50">
        {value}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const normalized = status ?? "SIN PRUEBAS";
  const isOk = normalized === "OK";
  const className = isOk
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-200";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {normalized}
    </span>
  );
}

function conditionLabel(condition: string | null) {
  const labels: Record<string, string> = {
    CONSUMIDOR_FINAL: "Consumidor final",
    RESPONSABLE_INSCRIPTO: "Responsable inscripto",
    MONOTRIBUTO: "Monotributo",
    EXENTO: "Exento",
    NO_RESPONSABLE: "No responsable",
    EXTERIOR: "Exterior",
    OTHER: "Otro"
  };

  return condition ? labels[condition] ?? condition : "Sin cargar";
}

function defaultVatLabel(setting: FiscalSettingView) {
  if (!setting.defaultTaxTreatment) {
    return "Sin cargar";
  }

  if (setting.defaultTaxTreatment === "EXEMPT") {
    return "Exento";
  }

  if (setting.defaultTaxTreatment === "NON_TAXABLE") {
    return "No gravado";
  }

  return `${setting.defaultVatRate ?? "0"}% - codigo ${setting.defaultVatArcaCode ?? "-"}`;
}

function ActionResult({ state }: { state: ArcaTestState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <div
      className={
        state.error
          ? "mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100"
          : "mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
      }
    >
      <p className="font-medium">{state.error ?? state.success}</p>
      {state.result?.length ? (
        <dl className="mt-2 grid gap-1">
          {state.result.map((item) => (
            <div key={item.label} className="flex justify-between gap-3">
              <dt>{item.label}</dt>
              <dd className="text-right font-semibold">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {state.details ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-medium">Detalle tecnico</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/5 p-2 text-xs dark:bg-white/10">
            {state.details}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function formatStatusDate(status: string | null, value: Date | string | null) {
  if (!status && !value) {
    return "Sin pruebas";
  }

  return [status ?? "Sin estado", formatDateTime(value)].filter(Boolean).join(" - ");
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "Sin datos";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin datos";
  }

  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}
