"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelFiscalBeforeIssueAction,
  markFiscalNotRequestedAction,
  prepareFiscalDocumentAction,
  type FiscalActionState
} from "./actions";

type FiscalSaleActionsProps = {
  saleId: string;
  canPrepare: boolean;
  canMarkNotRequested: boolean;
  canCancelBeforeIssue: boolean;
};

const initialState: FiscalActionState = {};

export function FiscalSaleActions({
  saleId,
  canPrepare,
  canMarkNotRequested,
  canCancelBeforeIssue
}: FiscalSaleActionsProps) {
  const [prepareState, prepareAction, preparing] = useActionState(
    prepareFiscalDocumentAction.bind(null, saleId),
    initialState
  );
  const [notRequestedState, notRequestedAction, marking] = useActionState(
    markFiscalNotRequestedAction.bind(null, saleId),
    initialState
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelFiscalBeforeIssueAction.bind(null, saleId),
    initialState
  );
  const state = prepareState.error || prepareState.success
    ? prepareState
    : notRequestedState.error || notRequestedState.success
      ? notRequestedState
      : cancelState;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canPrepare ? (
          <form action={prepareAction}>
            <Button type="submit" size="sm" disabled={preparing}>
              {preparing ? "Preparando..." : "Preparar factura"}
            </Button>
          </form>
        ) : null}
        {canMarkNotRequested ? (
          <form action={notRequestedAction}>
            <Button type="submit" size="sm" variant="secondary" disabled={marking}>
              Ticket interno
            </Button>
          </form>
        ) : null}
      </div>
      {canCancelBeforeIssue ? (
        <form action={cancelAction} className="flex flex-wrap gap-2">
          <Input
            name="reason"
            placeholder="Motivo"
            className="h-9 min-w-44 flex-1"
            required
          />
          <Button type="submit" size="sm" variant="danger" disabled={cancelling}>
            {cancelling ? "Anulando..." : "Anular antes de emitir"}
          </Button>
        </form>
      ) : null}
      {state.error || state.success ? (
        <p
          className={
            state.error
              ? "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
              : "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
          }
        >
          {state.error ?? state.success}
        </p>
      ) : null}
    </div>
  );
}
