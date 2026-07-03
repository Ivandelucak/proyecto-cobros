"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AppAccordion } from "@/components/ui/overlay";
import type {
  MercadoPagoAccountView,
  MercadoPagoAttemptView
} from "@/lib/mercadopago/mercado-pago-types";
import { formatARS } from "@/lib/money";
import { cn } from "@/lib/ui";

type MercadoPagoQrModalProps = {
  open: boolean;
  attempt: MercadoPagoAttemptView | null;
  account: MercadoPagoAccountView | null;
  message: string | null;
  technicalDetail: string | null;
  pending: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onGenerateNew: () => void;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  ERROR: "Error"
};

export function MercadoPagoQrModal({
  open,
  attempt,
  account,
  message,
  technicalDetail,
  pending,
  onClose,
  onRefresh,
  onCancel,
  onGenerateNew
}: MercadoPagoQrModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !attempt) {
    return null;
  }

  const status = attempt.status;
  const pendingAttempt = status === "PENDING";
  const approvedAttempt = status === "APPROVED";
  const failedAttempt = ["REJECTED", "CANCELLED", "EXPIRED", "ERROR"].includes(status);
  const shortReference = shorten(attempt.externalReference);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cobro con QR Mercado Pago"
    >
      <div className="app-panel flex max-h-[calc(100vh-2rem)] w-full max-w-2xl animate-[qr-modal-in_160ms_ease-out] flex-col overflow-hidden rounded-xl shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--panel-border)] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Cobro con QR Mercado Pago
              </h2>
              <StatusBadge status={status} />
              {account?.environment === "SANDBOX" ? (
                <span className="badge-warning rounded-full px-2 py-0.5 text-xs font-semibold">
                  Sandbox
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Escanea el QR para pagar
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Cerrar cobro Mercado Pago"
            title="Cerrar"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Total a cobrar
            </p>
            <p className="mt-1 text-4xl font-extrabold text-[var(--text-primary)]">
              {formatARS(attempt.amount)}
            </p>
          </div>

          <div className="mt-5 flex justify-center">
            {approvedAttempt ? (
              <div className="badge-success flex h-64 w-64 flex-col items-center justify-center rounded-2xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-current text-2xl font-black">
                  OK
                </div>
                <p className="mt-4 text-sm font-semibold">
                  Pago aprobado y aplicado a la venta.
                </p>
              </div>
            ) : attempt.qrCodeDataUrl && pendingAttempt ? (
              <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white p-4 shadow-sm dark:bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attempt.qrCodeDataUrl}
                  alt="QR Mercado Pago"
                  className="h-[min(54vh,68vw,360px)] w-[min(54vh,68vw,360px)] max-h-[360px] max-w-[360px] object-contain"
                />
              </div>
            ) : (
              <div className="app-panel-elevated flex min-h-48 w-full max-w-sm items-center justify-center rounded-2xl px-4 text-center text-sm text-[var(--text-secondary)]">
                {failedAttempt
                  ? "Este intento ya no esta disponible para escanear."
                  : "QR no disponible para este intento."}
              </div>
            )}
          </div>

          <div className="mt-4 text-center text-sm text-[var(--text-secondary)]">
            {pendingAttempt ? (
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--warning)]" />
                <span>Esperando aprobacion del pago...</span>
              </div>
            ) : approvedAttempt ? (
              <p>Operacion acreditada correctamente.</p>
            ) : (
              <p>{message ?? "Revisa el estado del intento o genera un nuevo QR."}</p>
            )}
            {pendingAttempt ? (
              <p className="mt-2">
                Abri Mercado Pago, escanea el codigo y confirma el pago.
              </p>
            ) : null}
          </div>

          <div className="app-panel-elevated mt-5 grid gap-2 rounded-lg p-3 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
            <InfoLine label="Cuenta" value={account?.name ?? attempt.accountName} />
            <InfoLine label="Referencia" value={shortReference} title={attempt.externalReference} />
            <InfoLine label="Estado actual" value={statusLabels[status] ?? status} />
            <InfoLine
              label="Ultima actualizacion"
              value={formatDate(attempt.approvedAt) || formatDate(new Date().toISOString())}
            />
          </div>

          <AppAccordion title="Detalle tecnico" className="app-panel-elevated mt-3">
            <dl className="grid gap-2 text-[var(--text-secondary)]">
              <DetailLine label="externalReference" value={attempt.externalReference} />
              <DetailLine label="providerOrderId" value={attempt.providerOrderId ?? "-"} />
              <DetailLine label="providerPaymentId" value={attempt.providerPaymentId ?? "-"} />
              <DetailLine label="rawStatus" value={attempt.rawStatus ?? "-"} />
              <DetailLine label="statusDetail" value={attempt.rawStatusDetail ?? "-"} />
              <DetailLine label="approvedAt" value={formatDate(attempt.approvedAt) || "-"} />
              {technicalDetail ? <DetailLine label="error" value={technicalDetail} /> : null}
            </dl>
          </AppAccordion>
        </div>

        <div className="flex flex-col gap-2 border-t border-[color:var(--panel-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onRefresh}
          >
            {pending ? "Consultando..." : "Refrescar estado"}
          </Button>
          {pendingAttempt ? (
            <Button type="button" variant="danger" disabled={pending} onClick={onCancel}>
              Cancelar intento
            </Button>
          ) : failedAttempt ? (
            <Button type="button" variant="primary" disabled={pending} onClick={onGenerateNew}>
              Generar nuevo QR
            </Button>
          ) : null}
          <Button type="button" variant={approvedAttempt ? "primary" : "ghost"} onClick={onClose}>
            {approvedAttempt ? "Volver a la venta" : "Cerrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-semibold",
        status === "APPROVED" && "badge-success",
        status === "PENDING" && "badge-warning",
        status === "ERROR" && "badge-danger",
        !["APPROVED", "PENDING", "ERROR"].includes(status) &&
          "badge-neutral"
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

function InfoLine({
  label,
  value,
  title
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p className="truncate font-semibold text-[var(--text-primary)]" title={title ?? value}>
        {value}
      </p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="font-semibold text-[var(--text-primary)]">{label}</dt>
      <dd className="break-all font-mono text-[11px]">{value}</dd>
    </div>
  );
}

function shorten(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-5)}` : value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatStableArgentinaDateTime(date);
}

function formatStableArgentinaDateTime(date: Date) {
  const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return [
    `${padDatePart(argentinaTime.getUTCDate())}/${padDatePart(
      argentinaTime.getUTCMonth() + 1
    )}`,
    `${padDatePart(argentinaTime.getUTCHours())}:${padDatePart(
      argentinaTime.getUTCMinutes()
    )}`
  ].join(" ");
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}
