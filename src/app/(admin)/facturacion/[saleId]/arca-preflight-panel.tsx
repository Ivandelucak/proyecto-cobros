"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ArcaInvoiceRequestPreview } from "@/lib/fiscal/arca/arca-pre-emission";
import type {
  ArcaPreflightResult,
  ArcaPreflightStatusTone
} from "@/lib/fiscal/arca/arca-preflight";
import {
  executeArcaPreflightAction,
  type ArcaPreflightActionState
} from "../actions";

type ArcaPreflightPanelProps = {
  saleId: string;
  request: ArcaInvoiceRequestPreview;
  initialResult: ArcaPreflightResult;
};

const initialActionState: ArcaPreflightActionState = {};

export function ArcaPreflightPanel({
  saleId,
  request,
  initialResult
}: ArcaPreflightPanelProps) {
  const [state, formAction, pending] = useActionState(
    executeArcaPreflightAction.bind(null, saleId),
    initialActionState
  );
  const result = state.result ?? initialResult;
  const hasRun = Boolean(state.result);
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;
  const statusLabel = hasErrors
    ? "Con errores"
    : hasWarnings
      ? "Con advertencias"
      : "Listo para emision futura";
  const statusTone = hasErrors ? "red" : hasWarnings ? "amber" : "green";
  const requestWithPreflight = hasRun
    ? {
        ...request,
        preflight: result.preflight
      }
    : request;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Preflight ARCA
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Validacion no destructiva con consulta de numeracion WSFEv1.
          </p>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <PreflightInfo label="Ambiente" value={request.meta.environment} />
        <PreflightInfo label="Servicio" value={request.meta.service} />
        <PreflightInfo
          label="Punto de venta"
          value={result.pointOfSale ? String(result.pointOfSale) : "-"}
        />
        <PreflightInfo
          label="Tipo comprobante"
          value={
            result.voucherType
              ? `${result.voucherType} - ${result.voucherLabel}`
              : result.voucherLabel
          }
        />
        <PreflightInfo
          label="Ultimo autorizado"
          value={
            result.lastAuthorizedNumber === null
              ? "Sin consultar"
              : String(result.lastAuthorizedNumber)
          }
        />
        <PreflightInfo
          label="Proximo estimado"
          value={
            result.nextEstimatedNumber === null
              ? "Sin consultar"
              : String(result.nextEstimatedNumber)
          }
        />
        <PreflightInfo
          label="Token WSAA"
          value={result.arcaStatus.token.label}
          tone={result.arcaStatus.token.status}
        />
        <PreflightInfo
          label="Vencimiento token"
          value={formatDateTime(result.arcaStatus.token.expiresAt)}
        />
        <PreflightInfo
          label="WSFEv1"
          value={result.arcaStatus.wsfe.label}
          tone={result.arcaStatus.wsfe.status}
        />
        <PreflightInfo
          label="Consultado"
          value={formatDateTime(result.queriedAt)}
        />
      </div>

      <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gray-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-300">
        Este control no emite comprobantes ni reserva numeracion. El proximo
        numero es estimado y se confirmara al emitir.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <PreflightList
          title="Errores bloqueantes"
          items={result.errors}
          emptyText="Sin errores bloqueantes."
          tone="red"
        />
        <PreflightList
          title="Advertencias"
          items={result.warnings}
          emptyText="Sin advertencias."
          tone="amber"
        />
      </div>

      {state.error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      {result.arcaStatus.wsfe.details ? (
        <details className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          <summary className="cursor-pointer font-semibold">Detalle tecnico WSFEv1</summary>
          <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs">
            {result.arcaStatus.wsfe.details}
          </pre>
        </details>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form action={formAction}>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Ejecutando..." : "Ejecutar preflight ARCA"}
            </Button>
          </form>
          <Button type="button" disabled className="w-full sm:w-auto">
            Emitir en ARCA
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {hasErrors
            ? "Corregi los errores antes de emitir en una etapa futura."
            : "Listo para etapa futura de emision en homologacion."}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Pendiente de implementacion. El preflight solo valida y consulta
          numeracion.
        </p>
      </div>

      <details className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="cursor-pointer text-sm font-semibold text-gray-950 dark:text-gray-50">
          Request tecnico con preflight
        </summary>
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-md bg-white p-4 text-xs text-gray-800 dark:bg-black dark:text-gray-100">
          {JSON.stringify(requestWithPreflight, null, 2)}
        </pre>
      </details>
    </Card>
  );
}

function PreflightInfo({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: ArcaPreflightStatusTone;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${toneTextClass(tone)}`}>
        {value}
      </p>
    </div>
  );
}

function PreflightList({
  title,
  items,
  emptyText,
  tone
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: "amber" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100";

  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item} className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{emptyText}</p>
      )}
    </div>
  );
}

function toneTextClass(tone?: ArcaPreflightStatusTone) {
  if (tone === "OK") {
    return "text-emerald-700 dark:text-emerald-200";
  }
  if (tone === "WARNING") {
    return "text-amber-800 dark:text-amber-200";
  }
  if (tone === "ERROR") {
    return "text-red-700 dark:text-red-200";
  }

  return "text-gray-950 dark:text-gray-50";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}
