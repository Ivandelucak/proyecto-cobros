"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SettingsAlert,
  SettingsCard,
  SettingsField,
  SettingsGrid,
  SettingsSaveBar,
  SettingsSection,
  SettingsSwitchRow
} from "@/components/ui/settings";
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
      <SettingsCard>
        <SettingsSection
          title="Textos principales"
          description="Copys visibles en el comprobante interno y en la impresion."
        >
        <SettingsGrid>
          <SettingsField label="Titulo">
            <Input name="ticketTitle" defaultValue={setting.ticketTitle} />
          </SettingsField>
          <SettingsField label="Leyenda no fiscal">
            <Input name="nonFiscalLegend" defaultValue={setting.nonFiscalLegend} />
          </SettingsField>
          <SettingsField label="Texto superior">
            <Input name="headerText" defaultValue={setting.headerText ?? ""} />
          </SettingsField>
          <SettingsField label="Texto final">
            <Input name="thankYouText" defaultValue={setting.thankYouText} />
          </SettingsField>
          <SettingsField label="Pie adicional" className="md:col-span-2">
            <Input name="footerText" defaultValue={setting.footerText ?? ""} />
          </SettingsField>
        </SettingsGrid>
        </SettingsSection>
      </SettingsCard>

      <SettingsCard>
        <SettingsSection
          title="Datos visibles"
          description="Activa solo la informacion que realmente necesitas mostrar en el ticket."
        >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        </SettingsSection>
      </SettingsCard>

      <StateMessage state={state} />

      <SettingsSaveBar message="Guarda textos y datos visibles del ticket interno.">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar ticket"}
        </Button>
      </SettingsSaveBar>
    </form>
  );
}

function Toggle({ name, label, value }: { name: string; label: string; value: boolean }) {
  return (
    <SettingsSwitchRow name={name} label={label} defaultChecked={value} />
  );
}

function StateMessage({ state }: { state: TicketSettingsState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <SettingsAlert tone={state.error ? "danger" : "success"}>
      {state.error ?? state.success}
    </SettingsAlert>
  );
}
