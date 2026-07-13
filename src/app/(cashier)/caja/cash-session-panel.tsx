"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import { formatDateTimeStable, formatTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import {
  countPendingOfflineSales,
  isOfflineStorageAvailable
} from "@/lib/offline-sales/offline-db";
import {
  addCashMovementAction,
  closeCashSessionAction,
  openCashSessionAction,
  type CashSessionFormState
} from "./actions";

type CashMovementTypeValue = "INCOME" | "EXPENSE" | "CASH_WITHDRAWAL" | "CASH_ADJUSTMENT";
type PanelMode = "open" | "movement" | "close" | null;

type CashSessionPanelProps = {
  cashSession: CashSessionSnapshot | null;
  requireOpenSession: boolean;
  showExpectedCash: boolean;
  offlineContext: { businessId: string; userId: string } | null;
};

type CashSessionSnapshot = {
  id: string;
  openedAt: Date;
  openingAmount: string;
  notes: string | null;
  openedByName: string;
  summary: CashSessionSummary;
  movements: Array<{
    id: string;
    type: CashMovementTypeValue;
    amount: string;
    reason: string;
    createdAt: Date;
  }>;
};

type CashSessionSummary = {
  cashSales: string;
  manualIncome: string;
  manualExpense: string;
  cashWithdrawals: string;
  cashAdjustments: string;
  expectedCash: string;
};

const movementLabels: Record<CashMovementTypeValue, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
  CASH_WITHDRAWAL: "Retiro",
  CASH_ADJUSTMENT: "Ajuste"
};

const initialState: CashSessionFormState = {};

export function CashSessionPanel({
  cashSession,
  requireOpenSession,
  showExpectedCash,
  offlineContext
}: CashSessionPanelProps) {
  const [mode, setMode] = useState<PanelMode>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [offlineCloseWarning, setOfflineCloseWarning] = useState<string | null>(null);
  const [openState, openAction, opening] = useActionState(
    openCashSessionAction,
    initialState
  );
  const [movementState, movementAction, moving] = useActionState(
    addCashMovementAction,
    initialState
  );
  const [closeState, closeAction, closing] = useActionState(
    closeCashSessionAction,
    initialState
  );

  function toggleDetails() {
    setDetailsVisible((current) => {
      if (current) {
        setMode(null);
      }
      return !current;
    });
  }

  async function closeWithOfflineGuard(formData: FormData) {
    if (offlineContext && isOfflineStorageAvailable()) {
      const pending = await countPendingOfflineSales(
        offlineContext.businessId,
        offlineContext.userId
      );
      if (pending > 0) {
        setOfflineCloseWarning(
          `No se puede cerrar la caja: hay ${pending} venta${pending === 1 ? "" : "s"} offline pendiente${pending === 1 ? "" : "s"} de sincronizacion.`
        );
        return;
      }
    }

    setOfflineCloseWarning(null);
    closeAction(formData);
  }

  if (!cashSession) {
    return (
      <Card className="cash-session-panel border-l-4 border-l-[color:var(--danger)] p-3 shadow-lg shadow-slate-300/30 dark:shadow-none">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="red">Caja cerrada</Badge>
              <span className="text-sm text-[var(--text-muted)]">
                {requireOpenSession
                  ? "Las ventas estan bloqueadas."
                  : "Ventas habilitadas sin apertura obligatoria."}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => setMode(mode === "open" ? null : "open")}
            aria-expanded={mode === "open"}
          >
            {mode === "open" ? "Ocultar apertura" : "Abrir caja"}
          </Button>
        </div>

        {mode === "open" ? (
          <form
            action={openAction}
            className="app-panel-secondary mt-2 grid gap-2 rounded-lg p-2.5 shadow-sm dark:shadow-none md:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)_auto]"
          >
            <Input
              name="openingAmount"
              inputMode="decimal"
              placeholder="Monto inicial"
              required
            />
            <Input name="notes" placeholder="Observacion opcional" />
            <Button type="submit" variant="primary" disabled={opening}>
              {opening ? "Abriendo..." : "Confirmar apertura"}
            </Button>
          </form>
        ) : null}
        <StateMessage state={openState} />
      </Card>
    );
  }

  const recentMovements = cashSession.movements.slice(0, 3);

  return (
    <Card className="cash-session-panel border-l-4 border-l-[color:var(--success)] p-2.5 shadow-lg shadow-slate-300/30 dark:shadow-none">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone="green">Caja abierta</Badge>
          <span className="text-sm text-[var(--text-muted)]">
            Caja abierta · {formatDateTimeStable(cashSession.openedAt)}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-2"
          onClick={toggleDetails}
          aria-expanded={detailsVisible}
        >
          {detailsVisible ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
          {detailsVisible ? "Ocultar" : "Mostrar"}
        </Button>
      </div>

      {detailsVisible ? (
        <div className="mt-2 border-t border-[color:var(--panel-border)] pt-2">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-muted)]">
                Abierta por {cashSession.openedByName} ·{" "}
                {formatDateTimeStable(cashSession.openedAt)}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Summary label="Inicial" value={formatARS(cashSession.openingAmount)} />
                <Summary
                  label="Ventas efectivo"
                  value={formatARS(cashSession.summary.cashSales)}
                />
                <Summary
                  label="Movimientos"
                  value={formatARS(netMovements(cashSession.summary))}
                />
                {showExpectedCash ? (
                  <Summary
                    label="Efectivo esperado"
                    value={formatARS(cashSession.summary.expectedCash)}
                    strong
                  />
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setMode(mode === "movement" ? null : "movement")}
                aria-expanded={mode === "movement"}
              >
                Movimiento
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => setMode(mode === "close" ? null : "close")}
                aria-expanded={mode === "close"}
              >
                Cerrar caja
              </Button>
            </div>
          </div>

          {recentMovements.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {recentMovements.map((movement) => (
                <span
                  key={movement.id}
                  className="badge-neutral rounded-full px-2.5 py-1 shadow-sm dark:shadow-none"
                  title={movement.reason}
                >
                  {movementLabels[movement.type]} {formatARS(movement.amount)} -{" "}
                  {formatTimeStable(movement.createdAt)}
                </span>
              ))}
            </div>
          ) : null}

          {mode === "movement" ? (
            <form
              action={movementAction}
              className="app-panel-secondary mt-2 grid gap-2 rounded-lg p-2.5 shadow-sm dark:shadow-none md:grid-cols-2 xl:grid-cols-[160px_140px_minmax(0,1fr)_auto]"
            >
              <Select name="type" defaultValue="EXPENSE">
                {Object.entries(movementLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input name="amount" inputMode="decimal" placeholder="Monto" required />
              <Input name="reason" placeholder="Motivo obligatorio" required />
              <Button type="submit" disabled={moving}>
                {moving ? "Guardando..." : "Guardar movimiento"}
              </Button>
            </form>
          ) : null}
          {mode === "movement" ? <StateMessage state={movementState} /> : null}

          {mode === "close" ? (
            <form
              action={closeWithOfflineGuard}
              className="mt-2 grid gap-2 rounded-lg border p-2.5 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)_auto] badge-danger"
            >
              <Input
                name="countedCashAmount"
                inputMode="decimal"
                placeholder="Efectivo contado"
                required
              />
              <Input name="notes" placeholder="Observacion opcional" />
              <Button type="submit" variant="danger" disabled={closing}>
                {closing ? "Cerrando..." : "Confirmar cierre"}
              </Button>
            </form>
          ) : null}
          {mode === "close" && offlineCloseWarning ? (
            <p className="badge-warning mt-2 rounded-md px-3 py-2 text-sm">
              {offlineCloseWarning}
            </p>
          ) : null}
          {mode === "close" ? <StateMessage state={closeState} /> : null}
        </div>
      ) : null}
    </Card>
  );
}

function Summary({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="app-panel-elevated min-w-0 rounded-md px-3 py-1.5 shadow-sm dark:shadow-none">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-0.5 break-words text-base font-semibold text-[var(--text-primary)] 2xl:text-lg"
            : "mt-0.5 break-words text-sm font-semibold text-[var(--text-primary)]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function StateMessage({ state }: { state: CashSessionFormState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={
        state.error
          ? "badge-danger mt-3 rounded-md px-3 py-2 text-sm"
          : "badge-success mt-3 rounded-md px-3 py-2 text-sm"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}

function netMovements(summary: CashSessionSummary) {
  return (
    Number(summary.manualIncome) -
    Number(summary.manualExpense) -
    Number(summary.cashWithdrawals) +
    Number(summary.cashAdjustments)
  );
}
