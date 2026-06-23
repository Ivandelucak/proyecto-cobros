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
  showExpectedCash
}: CashSessionPanelProps) {
  const [mode, setMode] = useState<PanelMode>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
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

  if (!cashSession) {
    return (
      <Card className="border-slate-300 border-l-4 border-l-red-500 bg-white p-4 shadow-lg shadow-slate-300/30 dark:shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="red">Caja cerrada</Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
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
            className="mt-3 grid gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none md:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)_auto]"
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
    <Card className="border-slate-300 border-l-4 border-l-emerald-500 bg-white p-4 shadow-lg shadow-slate-300/30 dark:shadow-none">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone="green">Caja abierta</Badge>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Abierta desde {formatTimeStable(cashSession.openedAt)}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-2 border-slate-300 bg-slate-50 hover:bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
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
        <div className="mt-3 border-t border-slate-300 pt-3 dark:border-neutral-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Abierta por {cashSession.openedByName} el{" "}
                {formatDateTimeStable(cashSession.openedAt)}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {recentMovements.map((movement) => (
                <span
                  key={movement.id}
                  className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-300 dark:shadow-none"
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
              className="mt-3 grid gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none md:grid-cols-2 xl:grid-cols-[160px_140px_minmax(0,1fr)_auto]"
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
              action={closeAction}
              className="mt-3 grid gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/70 dark:bg-red-950/20 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)_auto]"
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
    <div className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-0.5 break-words text-base font-semibold text-gray-950 dark:text-gray-50 2xl:text-lg"
            : "mt-0.5 break-words text-sm font-semibold text-gray-950 dark:text-gray-50"
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
          ? "mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
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
