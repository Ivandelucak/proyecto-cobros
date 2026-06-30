"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  adjustCustomerBalanceAction,
  registerCustomerPaymentAction,
  type CustomerFormState
} from "../actions";

const initialState: CustomerFormState = {};

export function CustomerPaymentForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(
    registerCustomerPaymentAction.bind(null, customerId),
    initialState
  );

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
        Registrar pago
      </h2>
      <form action={formAction} className="mt-4 space-y-3">
        <Input name="amount" inputMode="decimal" placeholder="Monto" required />
        <Select name="paymentMethod" defaultValue="CASH">
          <option value="CASH">Efectivo</option>
          <option value="DEBIT">Debito</option>
          <option value="CREDIT">Credito</option>
          <option value="TRANSFER">Transferencia</option>
          <option value="MERCADOPAGO">MercadoPago</option>
        </Select>
        <Input name="notes" placeholder="Observacion opcional" />
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Registrando..." : "Registrar pago"}
        </Button>
      </form>
      <StateMessage state={state} />
    </Card>
  );
}

export function CustomerAdjustmentForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(
    adjustCustomerBalanceAction.bind(null, customerId),
    initialState
  );

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
        Ajustar saldo
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">
        Usa monto positivo para aumentar deuda o negativo para reducirla.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <Input name="amount" inputMode="decimal" placeholder="Ej: 1000 o -1000" required />
        <Input name="reason" placeholder="Motivo obligatorio" required />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando..." : "Aplicar ajuste"}
        </Button>
      </form>
      <StateMessage state={state} />
    </Card>
  );
}

function StateMessage({ state }: { state: CustomerFormState }) {
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
