"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelSaleAction, type CancelSaleState } from "./actions";

const initialState: CancelSaleState = {};

export function CancelSaleForm({ saleId }: { saleId: string }) {
  const [state, formAction, pending] = useActionState(
    cancelSaleAction.bind(null, saleId),
    initialState
  );

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        if (!window.confirm("Confirmar anulacion de la venta?")) {
          event.preventDefault();
        }
      }}
    >
      <Input name="reason" placeholder="Motivo obligatorio de anulacion" required />
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" variant="danger" className="w-full" disabled={pending}>
        {pending ? "Anulando..." : "Anular venta"}
      </Button>
    </form>
  );
}
