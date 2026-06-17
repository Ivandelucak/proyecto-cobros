"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { formatARS } from "@/lib/money";
import {
  addCashMovementAction,
  closeCashSessionAction,
  openCashSessionAction,
  type CashSessionFormState
} from "./actions";

type CashMovementTypeValue = "INCOME" | "EXPENSE" | "CASH_WITHDRAWAL" | "CASH_ADJUSTMENT";

type CashSessionPanelProps = {
  cashSession: CashSessionSnapshot | null;
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

export function CashSessionPanel({ cashSession }: CashSessionPanelProps) {
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

  if (!cashSession) {
    return (
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge tone="red">Caja cerrada</Badge>
            <h2 className="mt-3 text-lg font-semibold text-gray-950 dark:text-gray-50">
              Abri la caja para vender
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Las ventas quedan bloqueadas hasta registrar el monto inicial.
            </p>
          </div>
          <form action={openAction} className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
            <Input
              name="openingAmount"
              inputMode="decimal"
              placeholder="Monto inicial"
              required
            />
            <Input name="notes" placeholder="Observacion opcional" />
            <Button type="submit" variant="primary" disabled={opening}>
              {opening ? "Abriendo..." : "Abrir caja"}
            </Button>
          </form>
        </div>
        <StateMessage state={openState} />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">Caja abierta</Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Desde {formatDateTime(cashSession.openedAt)} por {cashSession.openedByName}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Inicial" value={formatARS(cashSession.openingAmount)} />
            <Summary label="Efectivo ventas" value={formatARS(cashSession.summary.cashSales)} />
            <Summary label="Movimientos" value={formatARS(netMovements(cashSession.summary))} />
            <Summary label="Esperado" value={formatARS(cashSession.summary.expectedCash)} strong />
          </div>

          <form action={movementAction} className="mt-5 grid gap-3 lg:grid-cols-[160px_140px_1fr_auto]">
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
              {moving ? "Guardando..." : "Movimiento"}
            </Button>
          </form>
          <StateMessage state={movementState} />

          {cashSession.movements.length > 0 ? (
            <div className="mt-4 grid gap-2 text-sm lg:grid-cols-2">
              {cashSession.movements.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-gray-950 dark:text-gray-50">
                      {movementLabels[movement.type]} - {formatARS(movement.amount)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(movement.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {movement.reason}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <form action={closeAction} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Cerrar caja
          </h2>
          <div className="mt-3 space-y-3">
            <Input
              name="countedCashAmount"
              inputMode="decimal"
              placeholder="Efectivo contado"
              required
            />
            <Input name="notes" placeholder="Observacion opcional" />
            <Button type="submit" variant="primary" className="w-full" disabled={closing}>
              {closing ? "Cerrando..." : "Cerrar caja"}
            </Button>
          </div>
          <StateMessage state={closeState} />
        </form>
      </div>
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
    <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={strong ? "mt-1 text-lg font-semibold text-gray-950 dark:text-gray-50" : "mt-1 font-medium text-gray-950 dark:text-gray-50"}>
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

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
