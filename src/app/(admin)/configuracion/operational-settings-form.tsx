"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SettingsAlert,
  SettingsCard,
  SettingsField,
  SettingsSaveBar,
  SettingsSection,
  SettingsSwitchRow
} from "@/components/ui/settings";
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
        <SettingsCard>
          <SettingsSection
            title="Caja"
            description="Comportamiento operativo de venta y apertura de caja."
          >
          <div className="space-y-3">
            <Toggle
              name="requireOpenSession"
              label="Exigir caja abierta para vender"
              description="Bloquea nuevas ventas si no hay una caja abierta."
              value={cashSetting.requireOpenSession}
            />
            <Toggle
              name="showExpectedCashToCashier"
              label="Mostrar efectivo esperado al cajero"
              description="Muestra resumen esperado de efectivo en la sesion."
              value={cashSetting.showExpectedCashToCashier}
            />
            <Toggle
              name="allowCashierCancelSale"
              label="Permitir anulacion por cajero"
              description="Habilita anulaciones operativas sin perfil administrador."
              value={cashSetting.allowCashierCancelSale}
            />
            <Toggle
              name="allowNegativeStock"
              label="Permitir stock negativo"
              description="Permite vender aunque el stock quede por debajo de cero."
              value={cashSetting.allowNegativeStock}
            />
            <SettingsField label="Productos rapidos visibles">
              <Input
                name="quickProductsLimit"
                type="number"
                min={4}
                max={48}
                step={1}
                defaultValue={cashSetting.quickProductsLimit}
              />
            </SettingsField>
            <input
              type="hidden"
              name="defaultSearchMode"
              value={cashSetting.defaultSearchMode ?? ""}
            />
          </div>
          </SettingsSection>
        </SettingsCard>

        <SettingsCard>
          <SettingsSection
            title="Stock"
            description="Preferencias generales para alertas y ajustes de stock."
          >
          <div className="space-y-3">
            <Toggle
              name="lowStockEnabled"
              label="Controlar stock bajo"
              description="Activa el control de minimos por producto."
              value={stockSetting.lowStockEnabled}
            />
            <Toggle
              name="showLowStockWarnings"
              label="Mostrar alertas de stock bajo"
              description="Muestra avisos visuales cuando el producto esta por debajo del minimo."
              value={stockSetting.showLowStockWarnings}
            />
            <Toggle
              name="allowManualStockAdjustment"
              label="Permitir ajustes manuales"
              description="Habilita correcciones manuales de inventario."
              value={stockSetting.allowManualStockAdjustment}
            />
            <SettingsField label="Stock minimo por defecto">
              <Input
                name="defaultMinStock"
                inputMode="decimal"
                defaultValue={stockSetting.defaultMinStock ?? ""}
                placeholder="Sin valor global"
              />
            </SettingsField>
          </div>
          </SettingsSection>
        </SettingsCard>
      </div>

      <StateMessage state={state} />

      <SettingsSaveBar message="Guarda preferencias operativas de caja y stock.">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar caja y stock"}
        </Button>
      </SettingsSaveBar>
    </form>
  );
}

function Toggle({
  name,
  label,
  value,
  description
}: {
  name: string;
  label: string;
  value: boolean;
  description?: string;
}) {
  return (
    <SettingsSwitchRow
      name={name}
      label={label}
      description={description}
      defaultChecked={value}
    />
  );
}

function StateMessage({ state }: { state: OperationalSettingsState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <SettingsAlert tone={state.error ? "danger" : "success"}>
      {state.error ?? state.success}
    </SettingsAlert>
  );
}
