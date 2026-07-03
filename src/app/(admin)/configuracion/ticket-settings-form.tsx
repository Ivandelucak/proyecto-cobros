"use client";

import { useActionState, useState } from "react";
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

  const [ticketTitle, setTicketTitle] = useState(setting.ticketTitle);
  const [nonFiscalLegend, setNonFiscalLegend] = useState(setting.nonFiscalLegend);
  const [headerText, setHeaderText] = useState(setting.headerText ?? "");
  const [thankYouText, setThankYouText] = useState(setting.thankYouText);
  const [footerText, setFooterText] = useState(setting.footerText ?? "");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="ticketTitle" value={ticketTitle} />
      <input type="hidden" name="nonFiscalLegend" value={nonFiscalLegend} />
      <input type="hidden" name="headerText" value={headerText} />
      <input type="hidden" name="thankYouText" value={thankYouText} />
      <input type="hidden" name="footerText" value={footerText} />
      <SettingsCard>
        <SettingsSection
          title="Textos principales"
          description="Copys visibles en el comprobante interno y en la impresion."
        >
        <SettingsGrid>
          <SettingsField
            label="Título"
            description="Se imprime en el encabezado principal del ticket."
          >
            <Input
              name="ticketTitle_input"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
            />
            <SoftValidation value={ticketTitle} />
          </SettingsField>
          <SettingsField
            label="Leyenda no fiscal"
            description="Advertencia legal no fiscal. Se imprime debajo del nombre."
          >
            <Input
              name="nonFiscalLegend_input"
              value={nonFiscalLegend}
              onChange={(e) => setNonFiscalLegend(e.target.value)}
            />
            <SoftValidation value={nonFiscalLegend} />
          </SettingsField>
          <SettingsField
            label="Texto superior"
            description="Se imprime debajo del nombre del comercio."
          >
            <Input
              name="headerText_input"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
            />
            <SoftValidation value={headerText} />
          </SettingsField>
          <SettingsField
            label="Texto final"
            description="Mensaje de despedida al final del ticket."
          >
            <Input
              name="thankYouText_input"
              value={thankYouText}
              onChange={(e) => setThankYouText(e.target.value)}
            />
            <SoftValidation value={thankYouText} />
          </SettingsField>
          <SettingsField
            label="Pie adicional"
            className="md:col-span-2"
            description="Texto secundario o redes sociales al pie del ticket."
          >
            <Input
              name="footerText_input"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
            />
            <SoftValidation value={footerText} />
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

function isFieldIncomplete(value: string | null | undefined) {
  if (!value || value.trim() === "") return true;
  const val = value.toLowerCase();
  return (
    val.includes("???") ||
    val.includes("test") ||
    val.includes("lorem ipsum") ||
    val.includes("texto de prueba") ||
    val.includes("condicion fiscal") ||
    val.includes("ingresos brutos")
  );
}

function SoftValidation({ value }: { value: string | null | undefined }) {
  if (!isFieldIncomplete(value)) return null;
  return (
    <span className="block text-xs font-semibold text-amber-600 dark:text-amber-500 mt-1">
      ⚠️ Este campo parece incompleto.
    </span>
  );
}

