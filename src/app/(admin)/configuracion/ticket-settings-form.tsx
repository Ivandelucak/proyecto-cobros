"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TicketSettingView } from "@/lib/ticket-settings";
import {
  updateTicketSettingsAction,
  type TicketSettingsState
} from "./actions";

type TicketSettingsFormProps = {
  setting: TicketSettingView;
};

const initialState: TicketSettingsState = {};

export function TicketSettingsForm({ setting }: TicketSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateTicketSettingsAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          title="Ticket"
          description="Textos y datos visibles en el comprobante no fiscal."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Titulo">
            <Input name="ticketTitle" defaultValue={setting.ticketTitle} />
          </Field>
          <Field label="Leyenda no fiscal">
            <Input name="nonFiscalLegend" defaultValue={setting.nonFiscalLegend} />
          </Field>
          <Field label="Texto superior">
            <Input name="headerText" defaultValue={setting.headerText ?? ""} />
          </Field>
          <Field label="Texto final">
            <Input name="thankYouText" defaultValue={setting.thankYouText} />
          </Field>
          <Field label="Pie adicional">
            <Input name="footerText" defaultValue={setting.footerText ?? ""} />
          </Field>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Toggle name="showBusinessName" label="Mostrar nombre" value={setting.showBusinessName} />
          <Toggle name="showCuit" label="Mostrar CUIT" value={setting.showCuit} />
          <Toggle name="showAddress" label="Mostrar direccion" value={setting.showAddress} />
          <Toggle name="showPhone" label="Mostrar telefono" value={setting.showPhone} />
          <Toggle name="showEmail" label="Mostrar email" value={setting.showEmail} />
          <Toggle name="showSeller" label="Mostrar vendedor" value={setting.showSeller} />
          <Toggle name="showCustomer" label="Mostrar cliente" value={setting.showCustomer} />
          <Toggle
            name="showPaymentDetails"
            label="Mostrar pagos"
            value={setting.showPaymentDetails}
          />
          <Toggle
            name="showStockUnit"
            label="Mostrar unidad"
            value={setting.showStockUnit}
          />
          <Toggle
            name="showBarcode"
            label="Mostrar codigo de barras"
            value={setting.showBarcode}
          />
          <Toggle
            name="showNonFiscalLegend"
            label="Mostrar leyenda no fiscal"
            value={setting.showNonFiscalLegend}
          />
        </div>
      </Card>

      <StateMessage state={state} />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar ticket"}
        </Button>
      </div>
    </form>
  );
}

function Toggle({ name, label, value }: { name: string; label: string; value: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <input
        type="checkbox"
        name={name}
        defaultChecked={value}
        className="h-4 w-4 rounded border-slate-300 text-brand-600"
      />
      <span className="font-medium text-gray-800 dark:text-gray-100">{label}</span>
    </label>
  );
}

function StateMessage({ state }: { state: TicketSettingsState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={
        state.error
          ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}

function SectionTitle({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
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
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}
