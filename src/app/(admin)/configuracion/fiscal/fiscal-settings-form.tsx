"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { AppModal } from "@/components/ui/overlay";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import { getProviderDelegationVisualStatus } from "@/lib/fiscal/provider-delegation-status";
import { updateFiscalSettingsAction, type FiscalSettingsState } from "./actions";
import {
  changeToLegacyConnectionAction,
  changeToProviderDelegationAction,
  declareProviderDelegationAction,
  verifyProviderDelegationAction,
  type ProviderDelegationState
} from "./provider-delegation-actions";

type FiscalSettingsFormProps = {
  setting: FiscalSettingView;
  provider: {
    configured: boolean;
    providerCuit: string | null;
  };
};

const initialState: FiscalSettingsState = {};
const initialProviderState: ProviderDelegationState = {};
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

export function FiscalSettingsForm({ setting, provider }: FiscalSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateFiscalSettingsAction,
    initialState
  );
  const [delegationState, delegationAction, delegationPending] = useActionState(
    declareProviderDelegationAction,
    initialProviderState
  );
  const [providerModeState, providerModeAction, providerModePending] = useActionState(
    changeToProviderDelegationAction,
    initialProviderState
  );
  const [legacyModeState, legacyModeAction, legacyModePending] = useActionState(
    changeToLegacyConnectionAction,
    initialProviderState
  );
  const [verificationState, verificationAction, verificationPending] = useActionState(
    verifyProviderDelegationAction,
    initialProviderState
  );

  const [connectionOpen, setConnectionOpen] = useState(false);
  const [providerChangeOpen, setProviderChangeOpen] = useState(false);
  const [legacyChangeOpen, setLegacyChangeOpen] = useState(false);
  const [certificatePem, setCertificatePem] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const usesProviderDelegation = setting.connectionMode === "PROVIDER_DELEGATION";
  const credentialsReady = setting.hasArcaCertificatePem && setting.hasArcaPrivateKeyPem;

  const closeConnection = () => {
    setCertificatePem("");
    setPrivateKeyPem("");
    setConnectionOpen(false);
  };

  return (
    <>
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

      {usesProviderDelegation ? (
        <ProviderDelegationAssistant
          setting={setting}
          provider={provider}
          delegationAction={delegationAction}
          delegationPending={delegationPending}
          delegationState={delegationState}
          verificationAction={verificationAction}
          verificationPending={verificationPending}
          verificationState={verificationState}
          onReturnToLegacy={() => setLegacyChangeOpen(true)}
        />
      ) : (
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionTitle title="Conexión con ARCA" />
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {credentialsReady
                  ? "Este comercio utiliza una conexión configurada por comercio."
                  : "Las credenciales de este comercio todavía están pendientes."}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setConnectionOpen(true)}>
              Configurar conexión
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-[var(--text-secondary)]">
              También podés usar la conexión administrada por Fox Point sin cargar certificados.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProviderChangeOpen(true)}
            >
              Usar conexión administrada por Fox Point
            </Button>
          </div>
          <StateMessage state={providerModeState} className="mt-4" />
        </Card>
      )}

      <StateMessage state={state} />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="min-w-48" disabled={pending}>
          {pending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>

      {!usesProviderDelegation ? (
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
          <StateMessage state={state} className="mt-4" />
        </AppModal>
      ) : null}
      </form>

      <AppModal
        open={providerChangeOpen}
        title="Usar conexión administrada por Fox Point"
        description="Confirmá cómo querés conectar este comercio con ARCA."
        onClose={() => setProviderChangeOpen(false)}
        footer={
          <form
            action={providerModeAction}
            className="flex justify-end gap-2"
            onSubmit={() => setProviderChangeOpen(false)}
          >
            <input type="hidden" name="confirmProviderDelegation" value="true" />
            <Button
              type="button"
              variant="outline"
              onClick={() => setProviderChangeOpen(false)}
              disabled={providerModePending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={providerModePending}
            >
              {providerModePending ? "Cambiando..." : "Confirmar conexión"}
            </Button>
          </form>
        }
      >
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Fox Point utilizará una conexión central para operar ante ARCA en representación de este
          comercio. La emisión mediante esta modalidad todavía permanecerá deshabilitada durante
          la etapa de validación.
        </p>
        <StateMessage state={providerModeState} className="mt-4" />
      </AppModal>

      <AppModal
        open={legacyChangeOpen}
        title="Volver a la conexión anterior"
        description="Confirmá el cambio de modalidad."
        onClose={() => setLegacyChangeOpen(false)}
        footer={
          <form action={legacyModeAction} className="flex justify-end gap-2">
            <input type="hidden" name="confirmLegacyConnection" value="true" />
            <Button
              type="button"
              variant="outline"
              onClick={() => setLegacyChangeOpen(false)}
              disabled={legacyModePending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={legacyModePending}
            >
              {legacyModePending ? "Cambiando..." : "Volver a conexión anterior"}
            </Button>
          </form>
        }
      >
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Al volver a la conexión anterior, Fox Point utilizará nuevamente las credenciales
          fiscales guardadas para este comercio.
        </p>
        <StateMessage state={legacyModeState} className="mt-4" />
      </AppModal>
    </>
  );
}

function ProviderDelegationAssistant({
  setting,
  provider,
  delegationAction,
  delegationPending,
  delegationState,
  verificationAction,
  verificationPending,
  verificationState,
  onReturnToLegacy
}: {
  setting: FiscalSettingView;
  provider: FiscalSettingsFormProps["provider"];
  delegationAction: (payload: FormData) => void;
  delegationPending: boolean;
  delegationState: ProviderDelegationState;
  verificationAction: (payload: FormData) => void;
  verificationPending: boolean;
  verificationState: ProviderDelegationState;
  onReturnToLegacy: () => void;
}) {
  const effectiveSetting = {
    ...setting,
    connectionMode: "PROVIDER_DELEGATION" as const
  };
  const status = getProviderDelegationVisualStatus(effectiveSetting, provider.configured);
  const [showInstructions, setShowInstructions] = useState(!setting.delegationDeclaredAt);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionTitle title="Conexión con ARCA" />
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{status.description}</p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <AssistantStep number="1" title="Datos fiscales">
          Completá los datos del comercio y guardá la configuración antes de continuar.
        </AssistantStep>
        <AssistantStep number="2" title="Delegación">
          <p>
            Autorizá a Fox Point desde ARCA para operar en representación de tu comercio.
          </p>
          {provider.providerCuit ? (
            <div className="mt-3 space-y-2">
              <CopyValue
                label="CUIT prestador"
                value={formatCuit(provider.providerCuit)}
                copyValue={provider.providerCuit}
              />
              <CopyValue label="Servicio" value="wsfe" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              La conexión administrada por Fox Point todavía no está disponible.
            </p>
          )}
          {showInstructions ? (
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs">
              <li>Ingresá a ARCA con tu clave fiscal.</li>
              <li>Abrí Administrador de Relaciones.</li>
              <li>Delegá Facturación Electrónica al CUIT indicado.</li>
              <li>Confirmá la operación.</li>
              <li>Volvé a Fox Point.</li>
            </ol>
          ) : null}
        </AssistantStep>
        <AssistantStep number="3" title="Verificación">
          Fox Point confirma la autorización y verifica la conexión sin emitir comprobantes.
        </AssistantStep>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {status.canDeclare ? (
          <Button
            type="submit"
            variant="outline"
            formAction={delegationAction}
            disabled={delegationPending}
          >
            {delegationPending ? "Registrando..." : "Ya realicé la delegación"}
          </Button>
        ) : setting.delegationDeclaredAt ? (
          <Button type="button" variant="outline" onClick={() => setShowInstructions(true)}>
            Volver a mostrar instrucciones
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          formAction={verificationAction}
          disabled={!status.canVerify || verificationPending}
        >
          {verificationPending ? "Verificando..." : "Verificar conexión con ARCA"}
        </Button>
        <Button type="button" variant="ghost" onClick={onReturnToLegacy}>
          Volver a conexión anterior
        </Button>
      </div>
      <StateMessage state={delegationState} className="mt-4" />
      <StateMessage state={verificationState} className="mt-4" />
    </Card>
  );
}

function AssistantStep({
  number,
  title,
  children
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
        {number}
      </span>
      <h3 className="mt-3 font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="mt-2 space-y-2 leading-5">{children}</div>
    </div>
  );
}

function CopyValue({
  label,
  value,
  copyValue = value
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2">
      <div className="min-w-0">
        <span className="block text-xs text-[var(--text-muted)]">{label}</span>
        <span className="block truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
          {value}
        </span>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={copy}>
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function formatCuit(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11
    ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
    : value;
}

function StatusBadge({
  tone,
  children
}: {
  tone: "neutral" | "warning" | "success" | "danger";
  children: React.ReactNode;
}) {
  const classes = {
    neutral: "border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] text-[var(--text-secondary)]",
    warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-100",
    success: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-100",
    danger: "border-red-300 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-100"
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes[tone]}`}>
      {children}
    </span>
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
  if (!setting.defaultTaxTreatment) return "";
  if (setting.defaultTaxTreatment === "EXEMPT") return "EXEMPT";
  if (setting.defaultTaxTreatment === "NON_TAXABLE") return "NON_TAXABLE";
  if (setting.defaultVatRate === "10.5") return "TAXED_10_5";
  if (setting.defaultVatRate === "27") return "TAXED_27";
  if (setting.defaultVatRate === "0") return "TAXED_0";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  state: FiscalSettingsState | ProviderDelegationState;
  className?: string;
}) {
  if (!state.error && !state.success) return null;

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
