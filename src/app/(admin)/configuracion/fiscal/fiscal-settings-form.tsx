"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { AppModal } from "@/components/ui/overlay";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import {
  updateFiscalSettingsAction,
  type FiscalSettingsState
} from "./actions";

type FiscalSettingsFormProps = {
  setting: FiscalSettingView;
};

const initialState: FiscalSettingsState = {};
const issueModeLabels = {
  ASK: "Preguntar",
  AUTO: "Automático",
  NEVER: "Nunca"
};
const fiscalConditionLabels = {
  "": "Sin especificar",
  CONSUMIDOR_FINAL: "Consumidor final",
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  NO_RESPONSABLE: "No responsable",
  EXTERIOR: "Exterior",
  OTHER: "Otro"
};
const letterLabels = {
  "": "Sin definir",
  A: "A",
  B: "B",
  C: "C",
  M: "M",
  E: "E"
};
const identityTypeLabels = {
  DNI: "DNI",
  CUIT: "CUIT",
  CUIL: "CUIL",
  CDI: "CDI",
  PASAPORTE: "Pasaporte",
  CONSUMIDOR_FINAL: "Consumidor final",
  OTHER: "Otro"
};
const fiscalTaxOptions = [
  ["", "Sin definir"],
  ["TAXED_21", "Gravado 21%"],
  ["TAXED_10_5", "Gravado 10.5%"],
  ["TAXED_27", "Gravado 27%"],
  ["TAXED_0", "Gravado 0%"],
  ["EXEMPT", "Exento"],
  ["NON_TAXABLE", "No gravado"]
] as const;

export function FiscalSettingsForm({ setting }: FiscalSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateFiscalSettingsAction,
    initialState
  );
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [certificatePem, setCertificatePem] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");

  const closeConnection = () => {
    setCertificatePem("");
    setPrivateKeyPem("");
    setConnectionOpen(false);
  };

  const credentialsReady = setting.hasArcaCertificatePem && setting.hasArcaPrivateKeyPem;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="environment" value={setting.environment} />
      <input
        type="hidden"
        name="pendingWarningMinutes"
        value={setting.pendingWarningMinutes}
      />
      <input
        type="hidden"
        name="pendingCriticalMinutes"
        value={setting.pendingCriticalMinutes}
      />

      <Card className="p-5">
        <SectionTitle title="Activación" />
        <div className="mt-4 max-w-md">
          <Toggle
            name="enabled"
            label="Habilitar facturación electrónica"
            value={setting.enabled}
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Datos fiscales" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="CUIT emisor">
            <Input name="cuit" defaultValue={setting.cuit ?? ""} />
          </Field>
          <Field label="Razón social">
            <Input name="legalName" defaultValue={setting.legalName ?? ""} />
          </Field>
          <Field label="Condición fiscal">
            <Select name="fiscalCondition" defaultValue={setting.fiscalCondition ?? ""}>
              {Object.entries(fiscalConditionLabels).map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Punto de venta">
            <Input
              name="pointOfSale"
              type="number"
              min={1}
              max={99999}
              defaultValue={setting.pointOfSale ?? ""}
            />
          </Field>
          <Field label="Letra de comprobante predeterminada">
            <Select
              name="defaultInvoiceLetter"
              defaultValue={setting.defaultInvoiceLetter ?? ""}
            >
              {Object.entries(letterLabels).map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Documento consumidor final">
            <Select name="defaultCustomerDocType" defaultValue={setting.defaultCustomerDocType}>
              {Object.entries(identityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Configuración fiscal" />
        <div className="mt-4 max-w-xl">
          <Field label="Tratamiento y alícuota de IVA predeterminados">
            <Select name="defaultFiscalTax" defaultValue={defaultFiscalTaxValue(setting)}>
              {fiscalTaxOptions.map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Política de emisión" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Efectivo">
            <IssueModeSelect name="cashIssueMode" value={setting.cashIssueMode} />
          </Field>
          <Field label="Medios electrónicos">
            <IssueModeSelect
              name="electronicPaymentIssueMode"
              value={setting.electronicPaymentIssueMode}
            />
          </Field>
          <Field label="Cuenta corriente">
            <IssueModeSelect
              name="currentAccountIssueMode"
              value={setting.currentAccountIssueMode}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Toggle
            name="allowCancelBeforeIssue"
            label="Permitir anular antes de emitir"
            value={setting.allowCancelBeforeIssue}
          />
          <Toggle
            name="requireCustomerForInvoiceA"
            label="Requerir cliente para factura A"
            value={setting.requireCustomerForInvoiceA}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionTitle title="Conexión con ARCA" />
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {credentialsReady ? "Credenciales cargadas." : "Credenciales pendientes."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setConnectionOpen(true)}>
            Configurar conexión
          </Button>
        </div>
      </Card>

      <StateMessage state={state} />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="min-w-48" disabled={pending}>
          {pending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>

      <AppModal
        open={connectionOpen}
        title="Conexión con ARCA"
        description="Estas credenciales permiten conectar Fox Point con ARCA."
        onClose={closeConnection}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeConnection} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          El certificado y la clave privada son distintos del CUIT.
        </p>
        <div className="mt-4 grid gap-4">
          <Field label="Certificado PEM">
            <Textarea
              name="arcaCertificatePem"
              rows={7}
              value={certificatePem}
              onChange={(event) => setCertificatePem(event.target.value)}
              spellCheck={false}
              placeholder="Pegar nuevo certificado PEM para reemplazar"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Clave privada PEM">
            <Textarea
              name="arcaPrivateKeyPem"
              rows={7}
              value={privateKeyPem}
              onChange={(event) => setPrivateKeyPem(event.target.value)}
              spellCheck={false}
              placeholder="Pegar nueva clave privada PEM para reemplazar"
              className="font-mono text-xs"
            />
          </Field>
        </div>
        {connectionOpen ? <StateMessage state={state} className="mt-4" /> : null}
      </AppModal>
    </form>
  );
}

function IssueModeSelect({ name, value }: { name: string; value: string }) {
  return (
    <Select name={name} defaultValue={value}>
      {Object.entries(issueModeLabels).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </Select>
  );
}

function defaultFiscalTaxValue(setting: FiscalSettingView) {
  if (!setting.defaultTaxTreatment) {
    return "";
  }

  if (setting.defaultTaxTreatment === "EXEMPT") {
    return "EXEMPT";
  }

  if (setting.defaultTaxTreatment === "NON_TAXABLE") {
    return "NON_TAXABLE";
  }

  if (setting.defaultVatRate === "10.5") {
    return "TAXED_10_5";
  }
  if (setting.defaultVatRate === "27") {
    return "TAXED_27";
  }
  if (setting.defaultVatRate === "0") {
    return "TAXED_0";
  }

  return "TAXED_21";
}

function Toggle({ name, label, value }: { name: string; label: string; value: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-3 py-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={value}
        className="h-4 w-4 rounded border-slate-300 text-brand-600"
      />
      <span className="font-medium text-[var(--text-primary)]">{label}</span>
    </label>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>;
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
      <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function StateMessage({
  state,
  className
}: {
  state: FiscalSettingsState;
  className?: string;
}) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${className ?? ""} ${
        state.error
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "border-[#BFE3D2] bg-[#E8F6EF] text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
