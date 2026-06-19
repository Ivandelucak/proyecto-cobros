"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CashRegisterSettingView } from "@/lib/cash-register-settings";
import type { StockSettingView } from "@/lib/stock-settings";
import {
  updateOperationalSettingsAction,
  type OperationalSettingsState
} from "./actions";

type OperationalSettingsFormProps = {
  cashSetting: CashRegisterSettingView;
  stockSetting: StockSettingView;
};

const initialState: OperationalSettingsState = {};

export function OperationalSettingsForm({
  cashSetting,
  stockSetting
}: OperationalSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateOperationalSettingsAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            title="Caja"
            description="Comportamiento operativo de venta y apertura de caja."
          />
          <div className="mt-4 space-y-3">
            <Toggle
              name="requireOpenSession"
              label="Exigir caja abierta para vender"
              value={cashSetting.requireOpenSession}
            />
            <Toggle
              name="showExpectedCashToCashier"
              label="Mostrar efectivo esperado al cajero"
              value={cashSetting.showExpectedCashToCashier}
            />
            <Toggle
              name="allowCashierCancelSale"
              label="Permitir anulacion por cajero"
              value={cashSetting.allowCashierCancelSale}
            />
            <Toggle
              name="allowNegativeStock"
              label="Permitir stock negativo"
              value={cashSetting.allowNegativeStock}
            />
            <Field label="Productos rapidos visibles">
              <Input
                name="quickProductsLimit"
                type="number"
                min={4}
                max={48}
                step={1}
                defaultValue={cashSetting.quickProductsLimit}
              />
            </Field>
            <input
              type="hidden"
              name="defaultSearchMode"
              value={cashSetting.defaultSearchMode ?? ""}
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Stock"
            description="Preferencias generales para alertas y ajustes de stock."
          />
          <div className="mt-4 space-y-3">
            <Toggle
              name="lowStockEnabled"
              label="Controlar stock bajo"
              value={stockSetting.lowStockEnabled}
            />
            <Toggle
              name="showLowStockWarnings"
              label="Mostrar alertas de stock bajo"
              value={stockSetting.showLowStockWarnings}
            />
            <Toggle
              name="allowManualStockAdjustment"
              label="Permitir ajustes manuales"
              value={stockSetting.allowManualStockAdjustment}
            />
            <Field label="Stock minimo por defecto">
              <Input
                name="defaultMinStock"
                inputMode="decimal"
                defaultValue={stockSetting.defaultMinStock ?? ""}
                placeholder="Sin valor global"
              />
            </Field>
          </div>
        </Card>
      </div>

      <StateMessage state={state} />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar caja y stock"}
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

function StateMessage({ state }: { state: OperationalSettingsState }) {
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
    <label className="block space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}
