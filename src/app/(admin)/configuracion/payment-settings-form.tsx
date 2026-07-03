"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode
} from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  SettingsAdvancedDetails,
  SettingsAlert,
  SettingsCard,
  SettingsField,
  SettingsRadioRow,
  SettingsSaveBar,
  SettingsSection,
  SettingsStatusBadge,
  SettingsSummaryCard,
  SettingsSwitchRow
} from "@/components/ui/settings";
import { formatARS } from "@/lib/money";
import type {
  MercadoPagoAccountView,
  MercadoPagoMovementView
} from "@/lib/mercadopago/mercado-pago-types";
import type { MercadoPagoOAuthConfigStatus } from "@/lib/mercadopago/mercado-pago-oauth";
import type {
  CreditInstallmentPlanView,
  PaymentMethodSettingView
} from "@/lib/payment-settings";
import { cn } from "@/lib/ui";
import {
  createMercadoPagoOAuthLinkAction,
  setupMercadoPagoPosAction,
  testMercadoPagoAccessTokenAction,
  testMercadoPagoAccountAction,
  testMercadoPagoPosAction,
  updatePaymentSettingsAction,
  type MercadoPagoPosSetupActionInput,
  type PaymentSettingsState
} from "./actions";

type PaymentSettingsFormProps = {
  methods: PaymentMethodSettingView[];
  creditPlans: CreditInstallmentPlanView[];
  mercadoPagoAccounts: MercadoPagoAccountView[];
  mercadoPagoOAuthStatus: MercadoPagoOAuthConfigStatus;
};

type MethodCode = PaymentMethodSettingView["method"];
type MercadoPagoMode = "MANUAL" | "API_QR";
type TestResult = {
  ok: boolean;
  message: string;
  collectorId?: string | null;
  nickname?: string | null;
  email?: string | null;
  testedAt?: string | null;
};
type OAuthLinkResult = {
  ok: boolean;
  url: string | null;
  qrCodeDataUrl: string | null;
  expiresAt: string | null;
  environment: "SANDBOX" | "PRODUCTION";
  message: string;
  technicalDetail?: string | null;
};
type MovementsResult = {
  ok: boolean;
  movements: MercadoPagoMovementView[];
  message: string;
  technicalDetail: string | null;
  queriedAt?: string | null;
};
type StartTransition = (callback: () => void) => void;
type PosSetupResult = {
  ok: boolean;
  message: string;
  status: "CREATED" | "EXISTING" | "OK" | "ERROR";
  storeId: string | null;
  externalStoreId: string;
  storeName: string;
  posId: string | null;
  externalPosId: string;
  posName: string;
  steps: Array<{
    step: string;
    status: string;
    message: string;
    storeId?: string | null;
    externalStoreId?: string | null;
    posId?: string | null;
    externalPosId?: string | null;
    technicalDetail?: string | null;
  }>;
  technicalDetail?: string | null;
};
type PosSetupDraft = MercadoPagoPosSetupActionInput;

const initialState: PaymentSettingsState = {};

const methodTitles: Record<MethodCode, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia bancaria",
  MERCADOPAGO: "Mercado Pago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

const methodDescriptions: Record<MethodCode, string> = {
  CASH: "Cobro directo en caja, con monto recibido y vuelto.",
  DEBIT: "Tarjeta de debito confirmada por el cajero.",
  CREDIT: "Tarjeta de credito con planes de cuotas configurados.",
  TRANSFER: "Datos bancarios visibles para confirmar transferencias manuales.",
  MERCADOPAGO: "Cobro manual o QR por venta segun la configuracion elegida.",
  CURRENT_ACCOUNT: "Saldo cargado al cliente seleccionado en caja."
};

const providerStatuses = [
  { value: "", label: "Sin estado por defecto" },
  { value: "MANUAL_CONFIRMED", label: "Confirmado manualmente" },
  { value: "ACREDITADO", label: "Acreditado" },
  { value: "PENDING", label: "Pendiente" },
  { value: "AUTHORIZED", label: "Autorizado" }
];

const bankFieldsMethods = new Set<MethodCode>(["TRANSFER"]);
const accountFieldsMethods = new Set<MethodCode>(["TRANSFER", "MERCADOPAGO"]);
const referenceMethods = new Set<MethodCode>([
  "DEBIT",
  "CREDIT",
  "TRANSFER",
  "MERCADOPAGO"
]);
const surchargeMethods = new Set<MethodCode>([
  "DEBIT",
  "CREDIT",
  "TRANSFER",
  "MERCADOPAGO"
]);

const TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY =
  "foxpoint.transfer.selectedVerificationAccountId";
const TRANSFER_VERIFICATION_ENABLED_STORAGE_KEY =
  "foxpoint.transfer.verificationEnabled";
const TRANSFER_ALLOW_PARTIALS_STORAGE_KEY =
  "foxpoint.transfer.allowPartials";
const TRANSFER_SHOW_RECENT_MOVEMENTS_STORAGE_KEY =
  "foxpoint.transfer.showRecentMovements";
const TRANSFER_AMOUNT_TOLERANCE_STORAGE_KEY =
  "foxpoint.transfer.amountTolerance";
const TRANSFER_RECENT_RANGE_STORAGE_KEY =
  "foxpoint.transfer.recentRange";
const TRANSFER_RECENT_LIMIT_STORAGE_KEY =
  "foxpoint.transfer.recentLimit";
const TRANSFER_RECENT_REFRESH_STORAGE_KEY =
  "foxpoint.transfer.recentRefreshSeconds";

export function PaymentSettingsForm({
  methods,
  creditPlans,
  mercadoPagoAccounts,
  mercadoPagoOAuthStatus
}: PaymentSettingsFormProps) {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(
    updatePaymentSettingsAction,
    initialState
  );
  const mercadoPagoSetting = methods.find((method) => method.method === "MERCADOPAGO");
  const [mercadoPagoMode, setMercadoPagoMode] = useState<MercadoPagoMode>(
    mercadoPagoSetting?.mercadoPagoMode === "API_QR" ? "API_QR" : "MANUAL"
  );
  const initialQrPreviews = useMemo(
    () =>
      Object.fromEntries(
        methods.map((method) => [method.method, method.qrImageDataUrl])
      ) as Record<MethodCode, string | null>,
    [methods]
  );
  const [qrPreviews, setQrPreviews] = useState(initialQrPreviews);
  const [removedQr, setRemovedQr] = useState<Partial<Record<MethodCode, boolean>>>({});
  const [clientMessage, setClientMessage] = useState<string | null>(null);

  function removeQr(method: MethodCode) {
    setQrPreviews((current) => ({ ...current, [method]: null }));
    setRemovedQr((current) => ({ ...current, [method]: true }));
    setClientMessage(null);
  }

  function handleQrChange(method: MethodCode, file: File | null) {
    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setClientMessage("El QR debe ser PNG, JPG o WebP.");
      return;
    }

    if (file.size > 2_000_000) {
      setClientMessage("El QR no puede superar 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setQrPreviews((current) => ({
        ...current,
        [method]: typeof reader.result === "string" ? reader.result : null
      }));
      setRemovedQr((current) => ({ ...current, [method]: false }));
      setClientMessage(null);
    };
    reader.readAsDataURL(file);
  }

  const enabledCount = methods.filter((method) => method.enabled).length;
  const productionAccounts = mercadoPagoAccounts.filter(
    (account) => account.environment === "PRODUCTION"
  );
  const activeProductionAccountCount = productionAccounts.filter(
    (account) => account.enabled
  ).length;
  const transferMethod = methods.find((method) => method.method === "TRANSFER");
  const activeCreditPlans = creditPlans.filter((plan) => plan.active).length;
  const oauthFeedback = getOAuthFeedback(searchParams);

  return (
    <form action={formAction} className="space-y-5">
      <SettingsCard>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsSummaryCard label="Medios activos" value={String(enabledCount)} />
          <SettingsSummaryCard
            label="Mercado Pago"
            value={activeProductionAccountCount > 0 ? "Conectado" : "Pendiente"}
            hint={
              activeProductionAccountCount > 0
                ? `${activeProductionAccountCount} cuenta${activeProductionAccountCount === 1 ? "" : "s"} productiva${activeProductionAccountCount === 1 ? "" : "s"}`
                : "Sin cuenta productiva activa"
            }
            tone={activeProductionAccountCount > 0 ? "success" : "warning"}
          />
          <SettingsSummaryCard
            label="Transferencias"
            value={transferMethod?.enabled ? "Activas" : "Inactivas"}
            hint="Verificacion opcional en caja"
            tone={transferMethod?.enabled ? "success" : "neutral"}
          />
          <SettingsSummaryCard
            label="Cuotas"
            value={`${activeCreditPlans} plan${activeCreditPlans === 1 ? "" : "es"}`}
            hint="Planes activos para credito"
            tone={activeCreditPlans > 0 ? "success" : "neutral"}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsSection
          title="Mercado Pago"
          description="Conecta una cuenta para cobrar con QR por venta en caja. Las opciones avanzadas quedan ocultas para soporte."
        >
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="app-panel-secondary rounded-lg p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              ¿Cómo querés cobrar con Mercado Pago?
            </p>
            <div className="mt-3 grid gap-2">
              <ModeOption
                checked={mercadoPagoMode === "MANUAL"}
                title="Cobro manual"
                description="El cajero verifica el pago y lo registra a mano."
                onChange={() => setMercadoPagoMode("MANUAL")}
              />
              <ModeOption
                checked={mercadoPagoMode === "API_QR"}
                title="QR por venta"
                description="Genera un QR con el importe exacto y confirma el pago con Mercado Pago."
                onChange={() => setMercadoPagoMode("API_QR")}
              />
            </div>
            <input
              type="hidden"
              name="method-MERCADOPAGO-mercadoPagoMode"
              value={mercadoPagoMode}
            />
          </div>

          <MercadoPagoAccountsPanel
            accounts={mercadoPagoAccounts}
            mercadoPagoMode={mercadoPagoMode}
            oauthStatus={mercadoPagoOAuthStatus}
          />
        </div>
        </SettingsSection>
      </SettingsCard>

      <SettingsCard>
        <SettingsSection
          title="Metodos manuales"
          description="Cada metodo muestra lo esencial. Los datos tecnicos y bancarios quedan en opciones avanzadas."
        >
        <div className="grid gap-3 xl:grid-cols-2">
          {methods.map((method) => (
            <PaymentMethodCard
              key={method.method}
              method={method}
              mercadoPagoMode={mercadoPagoMode}
              mercadoPagoAccounts={mercadoPagoAccounts}
              qrPreview={qrPreviews[method.method]}
              removedQr={Boolean(removedQr[method.method])}
              onQrChange={handleQrChange}
              onRemoveQr={removeQr}
            />
          ))}
        </div>
        </SettingsSection>
      </SettingsCard>

      <SettingsCard>
        <SettingsSection
          title="Cuotas de credito"
          description="Los planes activos se usan automaticamente al cobrar con credito."
        >
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Activo</th>
                <th className="px-3 py-2 font-medium">Cuotas</th>
                <th className="px-3 py-2 font-medium">Recargo %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--panel-border)]">
              {creditPlans.map((plan) => (
                <tr key={plan.id} className="transition-colors hover:bg-[var(--panel-bg-elevated)]">
                  <td className="px-3 py-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input
                      type="checkbox"
                      name={`plan-${plan.id}-active`}
                      defaultChecked={plan.active}
                      aria-label={`Activar ${plan.installments} cuotas`}
                      className="h-4 w-4 rounded border-[color:var(--panel-border-strong)] text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      name={`plan-${plan.id}-installments`}
                      defaultValue={plan.installments}
                      required
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      inputMode="decimal"
                      name={`plan-${plan.id}-surchargeRate`}
                      defaultValue={plan.surchargeRate}
                      required
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-[var(--panel-bg-secondary)]">
                <td className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]" colSpan={3}>
                  Agregar plan
                </td>
              </tr>
              <tr className="transition-colors hover:bg-[var(--panel-bg-elevated)]">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    name="newActive"
                    defaultChecked
                    aria-label="Nuevo plan activo"
                    className="h-4 w-4 rounded border-[color:var(--panel-border-strong)] text-brand-600 focus:ring-brand-500"
                  />
                </td>
                <td className="px-3 py-3">
                  <Input type="number" min={1} step={1} name="newInstallments" />
                </td>
                <td className="px-3 py-3">
                  <Input inputMode="decimal" name="newSurchargeRate" placeholder="0" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </SettingsSection>
      </SettingsCard>

      {clientMessage ? <Feedback tone="warn" message={clientMessage} /> : null}
      {oauthFeedback ? (
        <Feedback
          tone={oauthFeedback.tone}
          message={oauthFeedback.message}
        />
      ) : null}
      {state.error ? <Feedback tone="error" message={state.error} /> : null}
      {state.success ? <Feedback tone="success" message={state.success} /> : null}

      <SettingsSaveBar message="Los cambios impactan en caja al guardar.">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar pagos"}
        </Button>
      </SettingsSaveBar>
    </form>
  );
}

function MercadoPagoAccountsPanel({
  accounts,
  mercadoPagoMode,
  oauthStatus
}: {
  accounts: MercadoPagoAccountView[];
  mercadoPagoMode: MercadoPagoMode;
  oauthStatus: MercadoPagoOAuthConfigStatus;
}) {
  const productionAccounts = accounts
    .filter((account) => account.environment === "PRODUCTION")
    .sort(sortMercadoPagoAccountsForCustomer);
  const sandboxAccounts = accounts
    .filter((account) => account.environment === "SANDBOX")
    .sort(sortMercadoPagoAccountsForCustomer);

  return (
    <div className="space-y-3">
      <SettingsAlert tone="info">
        Para QR por venta solo necesitas conectar Mercado Pago. El comercio autoriza la cuenta y Fox Point guarda la conexion en el servidor.
      </SettingsAlert>
      <MercadoPagoOAuthConnectCard
        oauthStatus={oauthStatus}
        hasConnectedAccounts={accounts.length > 0}
      />
      {mercadoPagoMode === "API_QR" && accounts.length === 0 ? (
        <SettingsAlert tone="warning">
          Conecta una cuenta para generar QR por venta.
        </SettingsAlert>
      ) : null}
      {productionAccounts.length > 0 ? (
        <div className="space-y-3">
          {productionAccounts.map((account) => (
            <MercadoPagoAccountCard key={account.id} account={account} />
          ))}
        </div>
      ) : null}
      {sandboxAccounts.length > 0 ? (
        <SettingsAdvancedDetails
          title="Cuentas de prueba / Sandbox"
          description="Usalas para pruebas. No se mezclan con las cuentas productivas principales."
        >
          <div className="space-y-3">
            {sandboxAccounts.map((account) => (
              <MercadoPagoAccountCard key={account.id} account={account} />
            ))}
          </div>
        </SettingsAdvancedDetails>
      ) : null}
      <SettingsAdvancedDetails
        title="Opciones avanzadas / Soporte tecnico"
        description="Alternativas tecnicas para soporte. Para uso normal, conecta Mercado Pago con el boton principal."
      >
        <MercadoPagoNewAccountCard hasExistingAccounts={accounts.length > 0} />
      </SettingsAdvancedDetails>
      <MercadoPagoMovementsPanel accounts={accounts} />
    </div>
  );
}

function MercadoPagoOAuthConnectCard({
  oauthStatus,
  hasConnectedAccounts
}: {
  oauthStatus: MercadoPagoOAuthConfigStatus;
  hasConnectedAccounts: boolean;
}) {
  const [environment, setEnvironment] = useState<"SANDBOX" | "PRODUCTION">("PRODUCTION");
  const [linkResult, setLinkResult] = useState<OAuthLinkResult | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const oauthReady = oauthStatus.configured;
  const startUrl = `/api/mercadopago/oauth/start?environment=${environment}`;
  const connectButtonLabel = hasConnectedAccounts
    ? "Conectar otra cuenta"
    : "Conectar Mercado Pago";

  useEffect(() => {
    if (!qrModalOpen) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [qrModalOpen, router]);

  function connectMercadoPago() {
    setLinkResult(null);
    setCopyMessage(null);

    if (!oauthReady) {
      setLinkResult({
        ok: false,
        url: null,
        qrCodeDataUrl: null,
        expiresAt: null,
        environment,
        message: oauthStatus.message,
        technicalDetail: getOAuthDiagnosticsDetail(oauthStatus)
      });
      return;
    }

    setIsConnecting(true);
    const popup = window.open(startUrl, "_blank", "noopener,noreferrer");
    setIsConnecting(false);

    if (!popup) {
      setLinkResult({
        ok: false,
        url: null,
        qrCodeDataUrl: null,
        expiresAt: null,
        environment,
        message:
          "El navegador bloqueo la nueva pestana. Permiti ventanas emergentes o usa QR de vinculacion.",
        technicalDetail: JSON.stringify({ popupBlocked: true, startUrl }, null, 2)
      });
      return;
    }

    setConnectionMessage(
      "Se abrio Mercado Pago en una nueva pestana para autorizar la cuenta."
    );
  }

  function createQrLink() {
    setLinkResult(null);
    setCopyMessage(null);

    if (!oauthReady) {
      setLinkResult({
        ok: false,
        url: null,
        qrCodeDataUrl: null,
        expiresAt: null,
        environment,
        message: "No se puede generar el QR de vinculacion porque falta configurar la conexion automatica.",
        technicalDetail: getOAuthDiagnosticsDetail(oauthStatus)
      });
      return;
    }

    startTransition(async () => {
      const result = await createMercadoPagoOAuthLinkAction(environment);
      setLinkResult(result);
      if (result.ok) {
        setQrModalOpen(true);
      }
    });
  }

  async function copyLink() {
    if (!linkResult?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(linkResult.url);
      setCopyMessage("Link copiado.");
    } catch {
      setCopyMessage("No se pudo copiar el link automaticamente.");
    }
  }

  function refreshAfterAuthorization() {
    router.refresh();
    setConnectionMessage("Actualizando cuentas conectadas...");
  }

  return (
    <section className="app-panel-elevated rounded-lg p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {hasConnectedAccounts ? "Conectar otra cuenta Mercado Pago" : "Conectar Mercado Pago"}
            </p>
            <StatusPill tone={oauthReady ? "ok" : "warn"}>
              {oauthReady ? "Listo para conectar" : "Requiere configuracion"}
            </StatusPill>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Para uso normal, conecta Mercado Pago con el boton principal. El QR de esta tarjeta es de vinculacion, no de cobro.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={environment}
            disabled={!oauthReady || isPending || isConnecting}
            onChange={(event) =>
              setEnvironment(event.target.value === "SANDBOX" ? "SANDBOX" : "PRODUCTION")
            }
            className="min-w-36"
          >
            <option value="PRODUCTION">Produccion</option>
            <option value="SANDBOX">Sandbox</option>
          </Select>
          <Button
            type="button"
            variant="primary"
            className="min-w-48"
            disabled={!oauthReady || isPending || isConnecting}
            onClick={connectMercadoPago}
          >
            <MercadoPagoButtonIcon />
            <span>{isConnecting ? "Conectando..." : connectButtonLabel}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={createQrLink}
            disabled={!oauthReady || isPending || isConnecting}
          >
            {isPending ? "Generando..." : "QR de vinculacion"}
          </Button>
        </div>
      </div>

      {connectionMessage ? (
        <SettingsAlert tone="info" className="mt-4">
          {connectionMessage}
        </SettingsAlert>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
        Si Mercado Pago abre con una cuenta incorrecta, cerra sesion en Mercado Pago o usa una ventana privada para autorizar otra cuenta.
      </p>

      {!oauthReady ? (
        <SettingsAlert tone="warning" className="mt-4">
          <p className="font-semibold">No se puede conectar automaticamente todavia</p>
          <p className="mt-1">
            {oauthStatus.message} Soporte puede revisar el detalle tecnico si hace falta.
          </p>
        </SettingsAlert>
      ) : null}

      <SettingsAdvancedDetails
        title="Soporte tecnico de vinculacion"
        description="No se muestran secretos, tokens ni headers de autorizacion."
        className="mt-4"
      >
        {oauthStatus.redirectUriWarnings.length > 0 ? (
          <SettingsAlert tone="warning" className="mb-3">
            <p className="font-semibold">Revisar URL de retorno</p>
            <p className="mt-1">
              Mercado Pago requiere una URL HTTPS y publica. En desarrollo usa ngrok y registra exactamente esa URL.
            </p>
            <p className="mt-2 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-semibold">
              MP_REDIRECT_URI={oauthStatus.redirectUriExample}
            </p>
            <ul className="mt-2 list-inside list-disc text-xs">
              {oauthStatus.redirectUriWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </SettingsAlert>
        ) : null}
        <pre className="max-h-72 overflow-auto rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
          {getOAuthDiagnosticsDetail(oauthStatus)}
        </pre>
        {!oauthStatus.pkceEnabledLocal ? (
          <p className="badge-warning mt-2 rounded-md px-3 py-2 text-xs">
            Si PKCE esta activado en Mercado Pago Developers, desactivalo o implementa PKCE en Fox Point.
          </p>
        ) : null}
      </SettingsAdvancedDetails>

      {oauthReady ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={refreshAfterAuthorization}>
            Ya autorice, actualizar
          </Button>
        </div>
      ) : null}

      {linkResult ? (
        <div
          className={cn(
            "mt-4 rounded-lg border p-4",
            linkResult.ok ? "badge-info" : "badge-danger"
          )}
        >
          <p className="text-sm font-semibold">{linkResult.message}</p>
          {linkResult.technicalDetail ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">
                Ver detalle tecnico
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
                {linkResult.technicalDetail}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      <MercadoPagoOAuthQrModal
        open={qrModalOpen}
        result={linkResult}
        copyMessage={copyMessage}
        onCopy={copyLink}
        onClose={() => setQrModalOpen(false)}
      />
    </section>
  );
}

function MercadoPagoButtonIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white text-[11px] font-black tracking-tight text-[#1F5A7A] shadow-sm dark:border-white/15 dark:bg-[#E8F6FF]"
    >
      MP
    </span>
  );
}

function MercadoPagoOAuthQrModal({
  open,
  result,
  copyMessage,
  onCopy,
  onClose
}: {
  open: boolean;
  result: OAuthLinkResult | null;
  copyMessage: string | null;
  onCopy: () => void;
  onClose: () => void;
}) {
  if (!open || !result?.ok || !result.url || !result.qrCodeDataUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="QR de vinculacion Mercado Pago"
    >
      <div className="app-panel w-full max-w-lg rounded-xl p-5 shadow-2xl dark:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              QR de vinculacion
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Este QR es para vincular la cuenta Mercado Pago. No es un QR de cobro.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <div className="rounded-lg bg-white p-3">
            <Image
              src={result.qrCodeDataUrl}
              alt="QR de vinculacion Mercado Pago"
              width={180}
              height={180}
              unoptimized
              className="h-auto w-full"
            />
          </div>
          <div className="min-w-0 text-sm text-[var(--text-secondary)]">
            <p>
              Escanea este QR con la cuenta que queres conectar. Vence{" "}
              {result.expiresAt ? formatTestDate(result.expiresAt) : "pronto"}.
            </p>
            <p className="mt-2 truncate rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-2 py-1.5 text-xs">
              {result.url}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={result.url}
            className="btn-primary inline-flex min-h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Abrir en este dispositivo
          </a>
          <Button type="button" variant="secondary" onClick={onCopy}>
            Copiar link
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        {copyMessage ? (
          <p className="mt-3 text-xs font-semibold text-[var(--text-secondary)]">
            {copyMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MercadoPagoMovementsPanel({
  accounts
}: {
  accounts: MercadoPagoAccountView[];
}) {
  const usableAccounts = accounts.filter((account) => account.enabled);
  const [selectedAccountId, setSelectedAccountId] = useState(() =>
    getPreferredMercadoPagoMovementAccountId(usableAccounts)
  );
  const [rangeValue, setRangeValue] = useState("10");
  const [refreshSeconds, setRefreshSeconds] = useState("0");
  const [result, setResult] = useState<MovementsResult | null>(null);
  const [lastQueryAt, setLastQueryAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedAccount =
    usableAccounts.find((account) => account.id === selectedAccountId) ?? null;
  const selectedAccountRequiresReconnect = Boolean(selectedAccount?.oauthRequiresReconnect);
  const refreshSecondsNumber = Number(refreshSeconds);

  function refreshMovements() {
    runMercadoPagoMovementsRefresh({
      selectedAccountId,
      rangeValue,
      requiresReconnect: selectedAccountRequiresReconnect,
      resetResult: true,
      startTransition,
      setResult,
      setLastQueryAt
    });
  }

  useEffect(() => {
    if (!selectedAccountId || refreshSecondsNumber <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      runMercadoPagoMovementsRefresh({
        selectedAccountId,
        rangeValue,
        requiresReconnect: selectedAccountRequiresReconnect,
        resetResult: false,
        startTransition,
        setResult,
        setLastQueryAt
      });
    }, refreshSecondsNumber * 1000);
    return () => window.clearInterval(timer);
  }, [
    rangeValue,
    refreshSecondsNumber,
    selectedAccountId,
    selectedAccountRequiresReconnect,
    startTransition
  ]);

  return (
    <section className="app-panel-elevated rounded-lg p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Probar movimientos recientes
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Consulta cobros recientes para verificar que la cuenta conectada responde correctamente.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_140px_150px_auto]">
          <Select
            value={selectedAccountId}
            disabled={usableAccounts.length === 0}
            onChange={(event) => {
              setSelectedAccountId(event.target.value);
              setResult(null);
            }}
          >
            {usableAccounts.length === 0 ? (
              <option value="">Sin cuentas activas</option>
            ) : (
              usableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.defaultAccount ? "(pred.)" : ""}
                </option>
              ))
            )}
          </Select>
          <Select
            value={rangeValue}
            onChange={(event) => {
              setRangeValue(event.target.value);
              setResult(null);
            }}
          >
            <option value="5">Ultimos 5 min</option>
            <option value="10">Ultimos 10 min</option>
            <option value="30">Ultimos 30 min</option>
            <option value="120">Ultimas 2 h</option>
            <option value="today">Hoy</option>
          </Select>
          <Select
            value={refreshSeconds}
            onChange={(event) => setRefreshSeconds(event.target.value)}
          >
            <option value="0">Auto desactivado</option>
            <option value="5">Cada 5s</option>
            <option value="10">Cada 10s</option>
            <option value="15">Cada 15s</option>
            <option value="30">Cada 30s</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || !selectedAccountId}
            onClick={refreshMovements}
          >
            {isPending ? "Consultando..." : "Consultar"}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span className={refreshSecondsNumber > 0 ? "badge-success rounded-full px-2 py-1" : "badge-neutral rounded-full px-2 py-1"}>
          {refreshSecondsNumber > 0
            ? `Actualizando cada ${refreshSecondsNumber} segundos`
            : "Autoactualizacion desactivada"}
        </span>
        <span>
          Consulta: {lastQueryAt ? formatClock(lastQueryAt) : "-"}
        </span>
      </div>

      {selectedAccount?.oauthRequiresReconnect ? (
        <SettingsAlert tone="warning" className="mt-3">
          Esta cuenta necesita volver a vincularse antes de consultar movimientos.
        </SettingsAlert>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <SettingsAlert tone={result.ok ? "success" : "danger"}>
            {result.message}
            {result.technicalDetail ? (
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold">
                  Ver detalle tecnico
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
                  {result.technicalDetail}
                </pre>
              </details>
            ) : null}
          </SettingsAlert>

          {result.movements.length === 0 ? (
            <div className="app-panel-secondary rounded-lg px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              {result.ok
                ? "Sin cobros recientes para el rango seleccionado."
                : "Error al consultar Mercado Pago."}
            </div>
          ) : (
            <div className="grid gap-2">
              {result.movements.map((movement) => (
                <MercadoPagoMovementPreview key={movement.id} movement={movement} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MercadoPagoMovementPreview({
  movement
}: {
  movement: MercadoPagoMovementView;
}) {
  return (
    <div className="app-panel rounded-lg p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-extrabold text-[var(--text-primary)]">
              {formatARS(movement.amount)}
            </p>
            <StatusPill tone={movement.status === "approved" ? "ok" : "muted"}>
              {formatMovementStatus(movement.status)}
            </StatusPill>
            {movement.alreadyUsed ? (
              <StatusPill tone="muted">
                {movement.usedSaleNumber
                  ? `Usado en #${movement.usedSaleNumber}`
                  : "Usado"}
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {formatMovementDate(movement.dateApproved ?? movement.dateCreated)} - ID{" "}
            {shortMercadoPagoId(movement.id)}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {[movement.accountName, movement.externalReference && shortMercadoPagoId(movement.externalReference)]
              .filter(Boolean)
              .join(" - ") || "Sin referencia"}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {[movement.paymentMethod, movement.paymentType, movement.operationType]
              .filter(Boolean)
              .join(" - ") || "Metodo no informado"}
          </p>
          {movement.payerLabelSafe ? (
            <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
              Pagador: {movement.payerLabelSafe}
            </p>
          ) : null}
        </div>
        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">
            Detalle tecnico
          </summary>
          <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-2 text-[11px]">
            {JSON.stringify(movement.rawSummary, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function MercadoPagoAccountCard({ account }: { account: MercadoPagoAccountView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPosPending, startPosTransition] = useTransition();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [posResult, setPosResult] = useState<PosSetupResult | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [posDraft, setPosDraft] = useState<PosSetupDraft>(() =>
    createInitialPosDraft(account)
  );
  const detectedCollectorId = testResult?.collectorId ?? account.collectorId ?? "";
  const visiblePosStatus = posResult
    ? posResult.status
    : account.lastPosSetupStatus ?? (account.externalPosId ? "OK" : "MISSING");
  const visibleStoreExternalId = posResult
    ? posResult.externalStoreId
    : account.externalStoreId ?? "-";
  const visibleStoreId = posResult?.storeId ?? account.storeId ?? "-";
  const visiblePosExternalId = posResult && (posResult.ok || posResult.posId)
    ? posResult.externalPosId
    : account.externalPosId ?? "-";
  const visiblePosId = posResult ? posResult.posId ?? "-" : account.posId ?? "-";
  const configuredExternalPosId = posResult?.ok
    ? posResult.externalPosId
    : account.externalPosId;
  const hasStoreWithoutPos = Boolean(
    (posResult?.storeId || account.storeId) && !configuredExternalPosId
  );

  function testConnection() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testMercadoPagoAccountAction(account.id);
      setTestResult(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function updatePosDraft(
    field:
      | "storeName"
      | "externalStoreId"
      | "posName"
      | "externalPosId"
      | "posCategory",
    value: string
  ) {
    setPosDraft((current) => ({ ...current, [field]: value }));
    setPosResult(null);
  }

  function updateLocationDraft(
    field: keyof PosSetupDraft["location"],
    value: string
  ) {
    setPosDraft((current) => ({
      ...current,
      location: { ...current.location, [field]: value }
    }));
    setPosResult(null);
  }

  function setupPos() {
    setPosResult(null);
    startPosTransition(async () => {
      const result = await setupMercadoPagoPosAction(account.id, posDraft);
      setPosResult(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function testPos() {
    if (!configuredExternalPosId) {
      setPosResult({
        ok: false,
        message: hasStoreWithoutPos
          ? "Sucursal creada, falta crear caja."
          : "Primero crea la sucursal.",
        status: "ERROR",
        storeId: posResult?.storeId ?? account.storeId,
        externalStoreId: posResult?.externalStoreId ?? account.externalStoreId ?? posDraft.externalStoreId,
        storeName: posResult?.storeName ?? account.storeName ?? posDraft.storeName,
        posId: null,
        externalPosId: "",
        posName: posDraft.posName,
        steps: []
      });
      return;
    }

    setPosResult(null);
    startPosTransition(async () => {
      const result = await testMercadoPagoPosAction(account.id, {
        externalStoreId: account.externalStoreId ?? posDraft.externalStoreId,
        externalPosId: configuredExternalPosId
      });
      setPosResult(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  const connectionHealthy = account.hasAccessToken && !account.oauthRequiresReconnect;
  const qrReady = visiblePosStatus === "OK";
  const qrStatusMessage = qrReady
    ? "Listo para cobrar"
    : "Requiere configuracion";

  const latestTestAt = testResult?.testedAt ?? account.lastConnectionTestAt;

  return (
    <>
    <details className="app-panel-elevated rounded-lg p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[var(--text-primary)]">
                {account.name}
              </p>
              <StatusPill tone={account.enabled ? "ok" : "muted"}>
                {account.enabled ? "Activa" : "Inactiva"}
              </StatusPill>
              {account.defaultAccount ? <StatusPill>Predeterminada</StatusPill> : null}
              <StatusPill tone={account.environment === "PRODUCTION" ? "ok" : "warn"}>
                {account.environment === "PRODUCTION" ? "Produccion" : "Sandbox"}
              </StatusPill>
              {account.oauthRequiresReconnect ? (
                <StatusPill tone="error">Reconectar</StatusPill>
              ) : (
                <StatusPill tone={connectionHealthy ? "ok" : "muted"}>
                  {connectionHealthy ? "Conexion vigente" : "Sin conexion"}
                </StatusPill>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {account.hasAccessToken ? "Conexion guardada" : "Conexion pendiente"}
              {account.accountNickname ? ` - ${account.accountNickname}` : ""}
              {account.accountEmail ? ` - ${account.accountEmail}` : ""}
              {account.oauthTokenExpiresAt
                ? ` - Vigente hasta ${formatTestDate(account.oauthTokenExpiresAt)}`
                : ""}
              {latestTestAt ? ` - Ultima prueba ${formatTestDate(latestTestAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending || !account.hasAccessToken}
              onClick={(event) => {
                event.preventDefault();
                testConnection();
              }}
            >
              {isPending ? "Probando..." : "Probar conexion"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(event) => {
                event.preventDefault();
                const details = event.currentTarget.closest("details");
                if (details) {
                  details.open = true;
                }
              }}
            >
              Editar nombre visible
            </Button>
            {!account.defaultAccount ? (
              <Button
                type="submit"
                name="mpDefaultAccountOverride"
                value={account.id}
                variant="secondary"
                size="sm"
                onClick={(event) => event.stopPropagation()}
              >
                Elegir predeterminada
              </Button>
            ) : null}
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={(event) => {
                event.preventDefault();
                setDisconnectOpen(true);
              }}
            >
              Desvincular
            </Button>
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-[color:var(--panel-border)] pt-4">
        <input type="hidden" name="mpAccountId" value={account.id} />
        <input
          type="hidden"
          name={`mp-${account.id}-externalPosId`}
          value={posResult?.ok ? posResult.externalPosId : account.externalPosId ?? ""}
          readOnly
        />
        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre visible">
            <Input name={`mp-${account.id}-name`} defaultValue={account.name} required />
          </Field>
          <Field label="Entorno">
            <Select name={`mp-${account.id}-environment`} defaultValue={account.environment}>
              <option value="SANDBOX">Sandbox</option>
              <option value="PRODUCTION">Produccion</option>
            </Select>
            <HelpText>Usa Sandbox para pruebas y Produccion para cobros reales.</HelpText>
          </Field>
          <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
            <CheckLine name={`mp-${account.id}-enabled`} defaultChecked={account.enabled}>
              Cuenta activa
            </CheckLine>
            <RadioLine
              name="mpDefaultAccount"
              value={account.id}
              defaultChecked={account.defaultAccount}
            >
              Cuenta predeterminada
            </RadioLine>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || !account.hasAccessToken}
              onClick={testConnection}
            >
              {isPending ? "Probando..." : "Probar conexion"}
            </Button>
            <Button type="submit" variant="primary">
              Guardar cambios
            </Button>
          </div>
        </section>

        <section className="app-panel-secondary rounded-lg p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                QR por venta
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Estado: {qrStatusMessage}. Caja: Caja principal.
              </p>
            </div>
            <StatusPill tone={getPosStatusTone(visiblePosStatus)}>
              {getPosStatusLabel(visiblePosStatus)}
            </StatusPill>
          </div>

          {account.lastPosSetupError && !posResult ? (
            <p className="badge-danger mt-3 rounded-md px-3 py-2 text-xs">
              No se pudo preparar el QR por venta. Revisa la cuenta conectada o reintenta la configuracion.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={isPosPending || !account.hasAccessToken}
              onClick={testPos}
            >
              {isPosPending ? "Probando..." : "Probar QR"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPosPending || !account.hasAccessToken}
              onClick={setupPos}
            >
              {isPosPending ? "Configurando..." : "Reconfigurar"}
            </Button>
          </div>
          {isPosPending ? (
            <p className="badge-info mt-3 rounded-md px-3 py-2 text-xs font-semibold">
              Validando la configuracion de QR por venta...
            </p>
          ) : null}
          {posResult ? <PosSetupResultBox result={posResult} /> : null}
        </section>

        <AdvancedOptions title="Opciones avanzadas / Soporte tecnico">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Access Token" className="md:col-span-2">
              <Input
                type="password"
                name={`mp-${account.id}-accessToken`}
                placeholder={account.hasAccessToken ? "Conservar conexion guardada" : "Access Token"}
                autoComplete="off"
              />
              <HelpText>
                Alternativa tecnica para soporte. Para uso normal, conecta Mercado Pago con el boton principal.
              </HelpText>
            </Field>
            <Field label="Public Key">
              <Input name={`mp-${account.id}-publicKey`} defaultValue={account.publicKey ?? ""} />
              <HelpText>Opcional. No bloquea el guardado si queda vacia.</HelpText>
            </Field>
            <Field label="Collector ID">
              <Input
                name={`mp-${account.id}-collectorId`}
                value={detectedCollectorId}
                readOnly
              />
              <HelpText>Se autodetecta con Probar conexion. No ingreses emails aca.</HelpText>
            </Field>
            <div className="md:col-span-2 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2 xl:grid-cols-5">
              <MetaLine label="External Store ID" value={visibleStoreExternalId} />
              <MetaLine label="Store ID" value={visibleStoreId} />
              <MetaLine label="External POS ID" value={visiblePosExternalId} />
              <MetaLine label="POS ID" value={visiblePosId} />
              <MetaLine
                label="Ultima preparacion"
                value={account.lastPosSetupAt ? formatTestDate(account.lastPosSetupAt) : "-"}
              />
            </div>
            {account.lastPosSetupError && !posResult ? (
              <p className="badge-danger md:col-span-2 rounded-md px-3 py-2 text-xs">
                {account.lastPosSetupError}
              </p>
            ) : null}
            <Field label="Nombre sucursal">
              <Input
                value={posDraft.storeName}
                onChange={(event) => updatePosDraft("storeName", event.target.value)}
              />
            </Field>
            <Field label="External store ID">
              <Input
                value={posDraft.externalStoreId}
                onChange={(event) =>
                  updatePosDraft("externalStoreId", normalizeExternalDraft(event.target.value))
                }
              />
            </Field>
            <Field label="Nombre caja">
              <Input
                value={posDraft.posName}
                onChange={(event) => updatePosDraft("posName", event.target.value)}
              />
            </Field>
            <Field label="External POS ID">
              <Input
                value={posDraft.externalPosId}
                maxLength={39}
                onChange={(event) =>
                  updatePosDraft("externalPosId", normalizeExternalDraft(event.target.value))
                }
              />
              <HelpText>Solo necesario para soporte tecnico de QR por venta.</HelpText>
            </Field>
            <Field label="Categoria/MCC">
              <Input
                inputMode="numeric"
                value={posDraft.posCategory ?? ""}
                placeholder="Opcional"
                onChange={(event) => updatePosDraft("posCategory", event.target.value)}
              />
            </Field>
            <Field label="Calle">
              <Input
                value={posDraft.location.streetName}
                onChange={(event) => updateLocationDraft("streetName", event.target.value)}
              />
            </Field>
            <Field label="Numero">
              <Input
                value={posDraft.location.streetNumber}
                onChange={(event) => updateLocationDraft("streetNumber", event.target.value)}
              />
            </Field>
            <Field label="Ciudad">
              <Input
                value={posDraft.location.cityName}
                onChange={(event) => updateLocationDraft("cityName", event.target.value)}
              />
            </Field>
            <Field label="Provincia">
              <Input
                value={posDraft.location.stateName}
                onChange={(event) => updateLocationDraft("stateName", event.target.value)}
              />
            </Field>
            <Field label="Latitud">
              <Input
                inputMode="decimal"
                value={posDraft.location.latitude}
                onChange={(event) => updateLocationDraft("latitude", event.target.value)}
              />
            </Field>
            <Field label="Longitud">
              <Input
                inputMode="decimal"
                value={posDraft.location.longitude}
                onChange={(event) => updateLocationDraft("longitude", event.target.value)}
              />
            </Field>
            <Field label="Referencia" className="md:col-span-2">
              <Input
                value={posDraft.location.reference ?? ""}
                placeholder="Opcional"
                onChange={(event) => updateLocationDraft("reference", event.target.value)}
              />
            </Field>
            <Field label="Ventana match (min)">
              <Select
                name={`mp-${account.id}-amountMatchingWindowMinutes`}
                defaultValue={normalizeMercadoPagoSelectOption(
                  account.amountMatchingWindowMinutes,
                  [5, 10, 15, 30],
                  10
                )}
              >
                <option value="5">5 minutos</option>
                <option value="10">10 minutos</option>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
              </Select>
            </Field>
            <Field label="Tolerancia match">
              <Input
                inputMode="decimal"
                name={`mp-${account.id}-amountMatchingTolerance`}
                defaultValue={account.amountMatchingTolerance}
              />
            </Field>
            <Field label="Frecuencia busqueda (seg)">
              <Select
                name={`mp-${account.id}-amountMatchingPollSeconds`}
                defaultValue={normalizeMercadoPagoSelectOption(
                  account.amountMatchingPollSeconds,
                  [5, 10, 15, 30],
                  5
                )}
              >
                <option value="5">Cada 5 segundos</option>
                <option value="10">Cada 10 segundos</option>
                <option value="15">Cada 15 segundos</option>
                <option value="30">Cada 30 segundos</option>
              </Select>
              <HelpText>Frecuencia de actualizacion del match automatico en caja.</HelpText>
            </Field>
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <CheckLine
                name={`mp-${account.id}-enableAmountMatching`}
                defaultChecked={account.enableAmountMatching}
              >
                Buscar coincidencias por monto
              </CheckLine>
              <CheckLine
                name={`mp-${account.id}-amountMatchingAutoApprove`}
                defaultChecked={account.amountMatchingAutoApprove}
              >
                Autoasociar matches exactos
              </CheckLine>
              <CheckLine
                name={`mp-${account.id}-showRecentMovements`}
                defaultChecked={account.showRecentMovements}
              >
                Mostrar movimientos recientes en caja
              </CheckLine>
            </div>
            <p className="badge-warning md:col-span-2 rounded-md px-3 py-2 text-xs">
              Buscar coincidencias es una ayuda manual para detectar pagos recientes por el mismo importe. No reemplaza al QR por venta.
            </p>
            <p className="badge-danger md:col-span-2 rounded-md px-3 py-2 text-xs">
              Autoasociar solo es seguro cuando el comercio recibe muy pocos pagos simultaneos del mismo monto.
            </p>
            <Field label="Instrucciones" className="md:col-span-2">
              <Textarea
                rows={2}
                name={`mp-${account.id}-instructions`}
                defaultValue={account.instructions ?? ""}
              />
            </Field>
          </div>
        </AdvancedOptions>
      </div>
      {testResult ? <TestResultBox result={testResult} /> : null}
    </details>
    <DisconnectMercadoPagoAccountDialog
      open={disconnectOpen}
      account={account}
      onClose={() => setDisconnectOpen(false)}
    />
    </>
  );
}

function DisconnectMercadoPagoAccountDialog({
  open,
  account,
  onClose
}: {
  open: boolean;
  account: MercadoPagoAccountView;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`disconnect-mp-${account.id}`}
    >
      <div className="app-panel w-full max-w-lg rounded-xl p-5 shadow-2xl dark:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={`disconnect-mp-${account.id}`}
              className="text-lg font-bold text-[var(--text-primary)]"
            >
              Desvincular Mercado Pago
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Vas a desvincular la cuenta {account.name}. Fox Point dejara de usarla para QR, cobros recientes y verificacion de transferencias.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="app-panel-secondary rounded-lg p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Cuenta
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)]">
                {account.name}
              </span>
              <StatusPill tone={account.environment === "PRODUCTION" ? "ok" : "warn"}>
                {account.environment === "PRODUCTION" ? "Produccion" : "Sandbox"}
              </StatusPill>
              {account.defaultAccount ? <StatusPill>Predeterminada</StatusPill> : null}
            </div>
          </div>
          <SettingsAlert tone="warning">
            Esta accion elimina la conexion de Mercado Pago guardada en Fox Point. No elimina tu cuenta de Mercado Pago ni borra las ventas historicas.
          </SettingsAlert>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            Fox Point desvincula la cuenta dentro del sistema. La sesion abierta en Mercado Pago depende del navegador.
          </p>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            name={`mp-${account.id}-deleteAccount`}
            value="on"
            variant="danger"
          >
            Desvincular cuenta
          </Button>
        </div>
      </div>
    </div>
  );
}

function MercadoPagoNewAccountCard({
  hasExistingAccounts
}: {
  hasExistingAccounts: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [accessToken, setAccessToken] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function testConnection() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testMercadoPagoAccessTokenAction(accessToken);
      setTestResult(result);
    });
  }

  return (
    <details className="app-panel-elevated rounded-lg p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              + Agregar cuenta manual por Access Token
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Alternativa avanzada para pruebas o cuentas tecnicas. Para usuarios finales usa Conectar Mercado Pago.
            </p>
          </div>
          <SettingsStatusBadge tone="warning">Avanzado</SettingsStatusBadge>
        </div>
      </summary>

      <div className="mt-4 space-y-4">
        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre de cuenta">
            <Input name="newMp-name" placeholder="Caja principal" />
          </Field>
          <Field label="Entorno">
            <Select name="newMp-environment" defaultValue="SANDBOX">
              <option value="SANDBOX">Sandbox</option>
              <option value="PRODUCTION">Produccion</option>
            </Select>
            <HelpText>Usa Sandbox para pruebas y Produccion para cobros reales.</HelpText>
          </Field>
          <Field label="Access Token" className="md:col-span-2">
            <Input
              type="password"
              name="newMp-accessToken"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              autoComplete="off"
              placeholder="APP_USR-..."
            />
            <HelpText>
              Pega el Access Token de Mercado Pago Developers. No se muestra completo despues de guardar.
            </HelpText>
          </Field>
          <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
            <CheckLine name="newMp-enabled" defaultChecked>
              Cuenta activa
            </CheckLine>
            <RadioLine
              name="mpDefaultAccount"
              value="new"
              defaultChecked={!hasExistingAccounts}
            >
              Cuenta predeterminada
            </RadioLine>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || !accessToken.trim()}
              onClick={testConnection}
            >
              {isPending ? "Probando..." : "Probar conexion"}
            </Button>
            <Button type="submit" variant="primary">
              Guardar cuenta
            </Button>
          </div>
          <p className="app-panel-secondary md:col-span-2 rounded-md px-3 py-2 text-xs text-[var(--text-secondary)]">
            Despues de guardar la cuenta, abri su bloque y crea la caja Mercado Pago para obtener el external_pos_id.
          </p>
        </section>

        <AdvancedOptions title="Opciones avanzadas">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Public Key">
              <Input name="newMp-publicKey" />
              <HelpText>Opcional. No bloquea el guardado si queda vacia.</HelpText>
            </Field>
            <Field label="Collector ID">
              <Input
                name="newMp-collectorId"
                value={testResult?.collectorId ?? ""}
                readOnly
              />
              <HelpText>Se autodetecta con Probar conexion. No ingreses emails aca.</HelpText>
            </Field>
            <Field label="Ventana match (min)">
              <Select
                name="newMp-amountMatchingWindowMinutes"
                defaultValue={10}
              >
                <option value="5">5 minutos</option>
                <option value="10">10 minutos</option>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
              </Select>
            </Field>
            <Field label="Tolerancia match">
              <Input inputMode="decimal" name="newMp-amountMatchingTolerance" defaultValue="0" />
            </Field>
            <Field label="Frecuencia busqueda (seg)">
              <Select
                name="newMp-amountMatchingPollSeconds"
                defaultValue={5}
              >
                <option value="5">Cada 5 segundos</option>
                <option value="10">Cada 10 segundos</option>
                <option value="15">Cada 15 segundos</option>
                <option value="30">Cada 30 segundos</option>
              </Select>
              <HelpText>Frecuencia de actualizacion del match automatico en caja.</HelpText>
            </Field>
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <CheckLine name="newMp-enableAmountMatching">
                Buscar coincidencias por monto
              </CheckLine>
              <CheckLine name="newMp-amountMatchingAutoApprove">
                Autoasociar matches exactos
              </CheckLine>
              <CheckLine name="newMp-showRecentMovements" defaultChecked>
                Mostrar movimientos recientes en caja
              </CheckLine>
            </div>
            <p className="badge-warning md:col-span-2 rounded-md px-3 py-2 text-xs">
              Buscar coincidencias es una ayuda manual para detectar pagos recientes por el mismo importe. No reemplaza al QR por venta. Autoasociar queda desactivado por defecto.
            </p>
            <p className="badge-danger md:col-span-2 rounded-md px-3 py-2 text-xs">
              Autoasociar solo es seguro cuando el comercio recibe muy pocos pagos simultaneos del mismo monto.
            </p>
            <Field label="Instrucciones" className="md:col-span-2">
              <Textarea rows={2} name="newMp-instructions" />
            </Field>
          </div>
        </AdvancedOptions>
        {testResult ? <TestResultBox result={testResult} /> : null}
      </div>
    </details>
  );
}

function MethodQuickFacts({ method }: { method: PaymentMethodSettingView }) {
  const surchargeParts = [
    method.surchargeRate ? `${method.surchargeRate}%` : null,
    method.fixedSurcharge ? formatARS(method.fixedSurcharge) : null
  ].filter(Boolean);
  const facts = [
    `Nombre visible: ${method.label}`,
    method.defaultProviderStatus
      ? `Estado: ${formatProviderStatusLabel(method.defaultProviderStatus)}`
      : null,
    surchargeParts.length > 0 ? `Recargo: ${surchargeParts.join(" + ")}` : null
  ].filter(Boolean);

  if (facts.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {facts.map((fact) => (
        <span
          key={fact}
          className="badge-neutral rounded-full px-2 py-0.5 text-[11px] font-semibold"
        >
          {fact}
        </span>
      ))}
    </div>
  );
}

function PaymentMethodCard({
  method,
  mercadoPagoMode,
  mercadoPagoAccounts,
  qrPreview,
  removedQr,
  onQrChange,
  onRemoveQr
}: {
  method: PaymentMethodSettingView;
  mercadoPagoMode: MercadoPagoMode;
  mercadoPagoAccounts: MercadoPagoAccountView[];
  qrPreview: string | null;
  removedQr: boolean;
  onQrChange: (method: MethodCode, file: File | null) => void;
  onRemoveQr: (method: MethodCode) => void;
}) {
  const showAccountFields = accountFieldsMethods.has(method.method);
  const showBankFields = bankFieldsMethods.has(method.method);
  const showReference = referenceMethods.has(method.method);
  const showSurcharge = surchargeMethods.has(method.method);
  const showQr = method.method === "MERCADOPAGO" && mercadoPagoMode === "MANUAL";

  return (
    <details
      className={cn(
        "app-panel-secondary rounded-lg p-4",
        !method.enabled && "opacity-80"
      )}
    >
      <input
        type="hidden"
        name={`method-${method.method}-sortOrder`}
        value={method.sortOrder}
      />
      {method.method !== "MERCADOPAGO" ? (
        <input
          type="hidden"
          name={`method-${method.method}-mercadoPagoMode`}
          value="MANUAL"
        />
      ) : null}
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {methodTitles[method.method]}
              </p>
              <SettingsStatusBadge tone={method.enabled ? "success" : "neutral"}>
                {method.enabled ? "Activo" : "Inactivo"}
              </SettingsStatusBadge>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {methodDescriptions[method.method]}
            </p>
            <MethodQuickFacts method={method} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <CheckLine name={`method-${method.method}-enabled`} defaultChecked={method.enabled}>
              Activo
            </CheckLine>
            <span className="badge-neutral inline-flex rounded-md px-3 py-1.5 text-xs font-semibold">
              Editar
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Nombre visible">
          <Input
            name={`method-${method.method}-label`}
            defaultValue={method.label}
            required
          />
        </Field>

        {showReference ? (
          <Field label="Estado por defecto">
            <Select
              name={`method-${method.method}-defaultProviderStatus`}
              defaultValue={method.defaultProviderStatus ?? ""}
            >
              {providerStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {showSurcharge ? (
          <>
            <Field label="Recargo %">
              <Input
                inputMode="decimal"
                name={`method-${method.method}-surchargeRate`}
                defaultValue={method.surchargeRate ?? ""}
                placeholder="0"
              />
            </Field>
            <Field label="Recargo fijo">
              <Input
                inputMode="decimal"
                name={`method-${method.method}-fixedSurcharge`}
                defaultValue={method.fixedSurcharge ?? ""}
                placeholder="0"
              />
            </Field>
          </>
        ) : null}
      </div>

      {method.method === "TRANSFER" ? (
        <section className="app-panel mt-4 rounded-lg p-4">
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Datos bancarios
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Informacion visible para confirmar transferencias manuales.
            </p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Banco">
              <Input name={`method-${method.method}-bankName`} defaultValue={method.bankName ?? ""} />
            </Field>
            <Field label="Alias">
              <Input name={`method-${method.method}-alias`} defaultValue={method.alias ?? ""} />
            </Field>
            <Field label="CBU">
              <Input name={`method-${method.method}-cbu`} defaultValue={method.cbu ?? ""} />
            </Field>
            <Field label="CVU">
              <Input name={`method-${method.method}-cvu`} defaultValue={method.cvu ?? ""} />
            </Field>
            <Field label="Titular">
              <Input
                name={`method-${method.method}-accountHolder`}
                defaultValue={method.accountHolder ?? ""}
              />
            </Field>
            <Field label="CUIT">
              <Input
                name={`method-${method.method}-accountCuit`}
                defaultValue={method.accountCuit ?? ""}
              />
            </Field>
            <Field label="Instrucciones" className="md:col-span-2">
              <Textarea
                name={`method-${method.method}-instructions`}
                defaultValue={method.instructions ?? ""}
                rows={3}
                placeholder="Texto breve visible para el cajero."
              />
            </Field>
          </div>
        </section>
      ) : null}

      {method.method === "TRANSFER" ? (
        <TransferVerificationSettings accounts={mercadoPagoAccounts} />
      ) : null}

      <AdvancedOptions title="Opciones avanzadas">
        <div className="grid gap-3 md:grid-cols-2">
          {showReference ? (
            <Field label="Referencia">
              <CheckLine
                name={`method-${method.method}-askReference`}
                defaultChecked={method.askReference}
              >
                Pedir numero de operacion
              </CheckLine>
            </Field>
          ) : null}

          {showBankFields && method.method !== "TRANSFER" ? (
            <Field label="Banco">
              <Input name={`method-${method.method}-bankName`} defaultValue={method.bankName ?? ""} />
            </Field>
          ) : null}

          {showAccountFields && method.method !== "TRANSFER" ? (
            <>
              <Field label="Alias">
                <Input name={`method-${method.method}-alias`} defaultValue={method.alias ?? ""} />
              </Field>
              <Field label="CBU">
                <Input name={`method-${method.method}-cbu`} defaultValue={method.cbu ?? ""} />
              </Field>
              <Field label="CVU">
                <Input name={`method-${method.method}-cvu`} defaultValue={method.cvu ?? ""} />
              </Field>
              <Field label="Titular">
                <Input
                  name={`method-${method.method}-accountHolder`}
                  defaultValue={method.accountHolder ?? ""}
                />
              </Field>
              <Field label="CUIT titular">
                <Input
                  name={`method-${method.method}-accountCuit`}
                  defaultValue={method.accountCuit ?? ""}
                />
              </Field>
            </>
          ) : null}

          {method.method !== "TRANSFER" ? (
            <Field label="Instrucciones" className="md:col-span-2">
              <Textarea
                name={`method-${method.method}-instructions`}
                defaultValue={method.instructions ?? ""}
                rows={3}
                placeholder="Texto breve visible para el cajero."
              />
            </Field>
          ) : null}

          {showQr ? (
            <div className="md:col-span-2">
              <input
                type="hidden"
                name={`method-${method.method}-qrImageDataUrl`}
                value={removedQr ? "" : method.qrImageDataUrl ?? ""}
              />
              {removedQr ? (
                <input type="hidden" name={`method-${method.method}-removeQr`} value="on" />
              ) : null}
              <p className="text-sm font-medium text-[var(--text-primary)]">
                QR estatico manual
              </p>
              <div className="app-panel-secondary mt-2 flex flex-col gap-3 rounded-md p-3 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)]">
                  {qrPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrPreview} alt="QR Mercado Pago" className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-2 text-center text-xs text-[var(--text-muted)]">
                      Sin QR
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    name={`method-${method.method}-qrFile`}
                    onChange={(event) =>
                      onQrChange(method.method, event.currentTarget.files?.[0] ?? null)
                    }
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    PNG, JPG o WebP. Maximo 2 MB.
                  </p>
                  {qrPreview ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onRemoveQr(method.method)}
                    >
                      Quitar QR
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : method.method === "MERCADOPAGO" ? (
            <input type="hidden" name={`method-${method.method}-qrImageDataUrl`} value="" />
          ) : null}
        </div>
      </AdvancedOptions>
    </details>
  );
}

function TransferVerificationSettings({
  accounts
}: {
  accounts: MercadoPagoAccountView[];
}) {
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.enabled),
    [accounts]
  );
  const fallbackAccountId =
    activeAccounts.find((account) => account.defaultAccount)?.id ??
    activeAccounts[0]?.id ??
    "";
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(fallbackAccountId);
  const [showRecentMovements, setShowRecentMovements] = useState(true);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState("0");
  const [recentRange, setRecentRange] = useState("10");
  const [recentLimit, setRecentLimit] = useState("5");
  const [amountTolerance, setAmountTolerance] = useState("0");
  const [allowPartials, setAllowPartials] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedAccountId = window.localStorage.getItem(
        TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY
      );
      const preferredAccountId =
        storedAccountId &&
        activeAccounts.some((account) => account.id === storedAccountId)
          ? storedAccountId
          : fallbackAccountId;
      const storedRange = window.localStorage.getItem(
        TRANSFER_RECENT_RANGE_STORAGE_KEY
      );
      const storedLimit = window.localStorage.getItem(
        TRANSFER_RECENT_LIMIT_STORAGE_KEY
      );
      const storedRefresh = window.localStorage.getItem(
        TRANSFER_RECENT_REFRESH_STORAGE_KEY
      );
      const storedTolerance = window.localStorage.getItem(
        TRANSFER_AMOUNT_TOLERANCE_STORAGE_KEY
      );

      setSelectedAccountId(preferredAccountId);
      setEnabled(
        window.localStorage.getItem(TRANSFER_VERIFICATION_ENABLED_STORAGE_KEY) !==
          "false"
      );
      setShowRecentMovements(
        window.localStorage.getItem(
          TRANSFER_SHOW_RECENT_MOVEMENTS_STORAGE_KEY
        ) !== "false"
      );
      setAllowPartials(
        window.localStorage.getItem(TRANSFER_ALLOW_PARTIALS_STORAGE_KEY) !==
          "false"
      );
      if (isTransferRecentRange(storedRange)) {
        setRecentRange(storedRange);
      }
      if (isTransferRecentLimit(storedLimit)) {
        setRecentLimit(storedLimit);
      }
      if (isTransferRefreshSeconds(storedRefresh)) {
        setAutoRefreshSeconds(storedRefresh);
      }
      if (storedTolerance && Number(storedTolerance) >= 0) {
        setAmountTolerance(sanitizeConfigMoneyInput(storedTolerance));
      }
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeAccounts, fallbackAccountId]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    window.localStorage.setItem(
      TRANSFER_VERIFICATION_ENABLED_STORAGE_KEY,
      String(enabled)
    );
    window.localStorage.setItem(
      TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY,
      selectedAccountId
    );
    window.localStorage.setItem(
      TRANSFER_SHOW_RECENT_MOVEMENTS_STORAGE_KEY,
      String(showRecentMovements)
    );
    window.localStorage.setItem(
      TRANSFER_RECENT_REFRESH_STORAGE_KEY,
      autoRefreshSeconds
    );
    window.localStorage.setItem(TRANSFER_RECENT_RANGE_STORAGE_KEY, recentRange);
    window.localStorage.setItem(TRANSFER_RECENT_LIMIT_STORAGE_KEY, recentLimit);
    window.localStorage.setItem(
      TRANSFER_AMOUNT_TOLERANCE_STORAGE_KEY,
      amountTolerance
    );
    window.localStorage.setItem(
      TRANSFER_ALLOW_PARTIALS_STORAGE_KEY,
      String(allowPartials)
    );
  }, [
    allowPartials,
    amountTolerance,
    autoRefreshSeconds,
    enabled,
    loaded,
    recentLimit,
    recentRange,
    selectedAccountId,
    showRecentMovements
  ]);

  return (
    <div className="app-panel mt-4 space-y-4 rounded-lg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Verificacion automatica
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Usa una cuenta Mercado Pago conectada para revisar transferencias recibidas. Es adicional a los datos bancarios manuales.
          </p>
        </div>
        <SettingsStatusBadge tone={enabled ? "success" : "neutral"}>
          {enabled ? "Activa" : "Manual"}
        </SettingsStatusBadge>
      </div>

      {activeAccounts.length === 0 ? (
        <SettingsAlert tone="warning">
          Conecta una cuenta Mercado Pago para verificar transferencias.
          La transferencia manual sigue funcionando con alias, CBU o CVU.
        </SettingsAlert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <ClientOnlySwitch
          checked={enabled}
          label="Habilitar verificacion"
          description="Permite revisar cobros recientes desde caja."
          onChange={setEnabled}
        />
        <ClientOnlySwitch
          checked={showRecentMovements}
          label="Mostrar movimientos recientes en caja"
          description="El cajero podra consultar movimientos y aplicar transferencias."
          disabled={!enabled}
          onChange={setShowRecentMovements}
        />
        <Field label="Proveedor">
          <Select value="MERCADOPAGO" disabled>
            <option value="MERCADOPAGO">Mercado Pago</option>
          </Select>
        </Field>
        <Field label="Cuenta predeterminada">
          <Select
            value={selectedAccountId}
            disabled={!enabled || activeAccounts.length === 0}
            onChange={(event) => setSelectedAccountId(event.target.value)}
          >
            {activeAccounts.length === 0 ? (
              <option value="">Sin cuentas conectadas</option>
            ) : null}
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} - {account.environment === "SANDBOX" ? "Sandbox" : "Produccion"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <AdvancedOptions title="Ajustes de verificacion">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Autoactualizacion">
            <Select
              value={autoRefreshSeconds}
              disabled={!enabled || !showRecentMovements}
              onChange={(event) => setAutoRefreshSeconds(event.target.value)}
            >
              <option value="0">Desactivado</option>
              <option value="5">Cada 5 segundos</option>
              <option value="10">Cada 10 segundos</option>
              <option value="15">Cada 15 segundos</option>
            </Select>
          </Field>
          <Field label="Rango de busqueda">
            <Select
              value={recentRange}
              disabled={!enabled || !showRecentMovements}
              onChange={(event) => setRecentRange(event.target.value)}
            >
              <option value="10">Ultimos 10 minutos</option>
              <option value="30">Ultimos 30 minutos</option>
              <option value="120">Ultimas 2 horas</option>
              <option value="today">Hoy</option>
            </Select>
          </Field>
          <Field label="Cantidad a listar">
            <Select
              value={recentLimit}
              disabled={!enabled || !showRecentMovements}
              onChange={(event) => setRecentLimit(event.target.value)}
            >
              <option value="5">5 movimientos</option>
              <option value="10">10 movimientos</option>
              <option value="20">20 movimientos</option>
            </Select>
          </Field>
          <Field label="Tolerancia de monto">
            <Input
              value={amountTolerance}
              inputMode="decimal"
              disabled={!enabled}
              onChange={(event) =>
                setAmountTolerance(sanitizeConfigMoneyInput(event.target.value))
              }
              placeholder="0"
            />
          </Field>
          <ClientOnlySwitch
            checked={allowPartials}
            label="Permitir pagos parciales"
            description="Si esta desactivado, una transferencia menor al pendiente no se puede aplicar."
            disabled={!enabled}
            onChange={setAllowPartials}
          />
          <p className="app-panel-secondary rounded-md px-3 py-2 text-xs leading-5 text-[var(--text-muted)] md:col-span-2">
            Preferencias guardadas en este puesto: no exponen tokens ni alteran la configuracion bancaria manual.
          </p>
        </div>
      </AdvancedOptions>
    </div>
  );
}

function ClientOnlySwitch({
  checked,
  label,
  description,
  disabled,
  onChange
}: {
  checked: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-[background-color,border-color,color]",
        disabled
          ? "cursor-not-allowed border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] opacity-70"
          : "border-[color:var(--panel-border)] bg-[var(--panel-bg)] hover:border-[color:var(--panel-border-strong)] hover:bg-[var(--panel-bg-elevated)]"
      )}
    >
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--text-primary)]">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span className="absolute inset-0 rounded-full border border-[color:var(--panel-border-strong)] bg-[var(--panel-bg-secondary)] transition-colors peer-checked:border-[color:var(--primary)] peer-checked:bg-[var(--primary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--primary)] peer-disabled:opacity-60" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-[var(--text-muted)] shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
}

function ModeOption({
  checked,
  title,
  description,
  onChange
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-[background-color,border-color,color]",
        checked
          ? "border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--text-primary)]"
          : "border-[color:var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-secondary)] hover:border-[color:var(--panel-border-strong)] hover:bg-[var(--panel-bg-elevated)] hover:text-[var(--text-primary)]"
      )}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 border-[color:var(--panel-border-strong)] text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-xs opacity-80">{description}</span>
      </span>
    </label>
  );
}

function CheckLine({
  name,
  defaultChecked,
  tone = "default",
  children
}: {
  name: string;
  defaultChecked?: boolean;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <SettingsSwitchRow
      name={name}
      defaultChecked={defaultChecked}
      label={children}
      tone={tone === "danger" ? "danger" : "neutral"}
    />
  );
}

function RadioLine({
  name,
  value,
  defaultChecked,
  children
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <SettingsRadioRow
      name={name}
      value={value}
      defaultChecked={defaultChecked}
      label={children}
    />
  );
}

function AdvancedOptions({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SettingsAdvancedDetails title={title}>{children}</SettingsAdvancedDetails>
  );
}

function TestResultBox({ result }: { result: TestResult }) {
  return (
    <SettingsAlert tone={result.ok ? "success" : "danger"} className="mt-3">
      <p className="font-semibold">{result.ok ? "Conexion OK" : "No se pudo conectar"}</p>
      <p className="mt-1">{result.message}</p>
      {result.nickname || result.email || result.testedAt ? (
        <p className="mt-1 text-xs opacity-80">
          {[result.nickname, result.email, result.testedAt ? formatTestDate(result.testedAt) : null]
            .filter(Boolean)
          .join(" - ")}
        </p>
      ) : null}
    </SettingsAlert>
  );
}

function PosSetupResultBox({ result }: { result: PosSetupResult }) {
  return (
    <SettingsAlert tone={result.ok ? "success" : "danger"} className="mt-3">
      <p className="font-semibold">
        {result.ok ? "Caja Mercado Pago lista" : "No se pudo configurar la caja"}
      </p>
      <p className="mt-1">{result.message}</p>
      {result.ok ? (
        <p className="mt-1 text-xs opacity-80">
          {result.externalStoreId} - {result.externalPosId}
          {result.posId ? ` - POS ${result.posId}` : ""}
        </p>
      ) : null}
      {result.steps.length > 0 ? (
        <ol className="mt-3 space-y-1 text-xs">
          {result.steps.map((step, index) => (
            <li
              key={`${step.step}-${index}`}
              className="app-panel-secondary flex items-start gap-2 rounded-md px-2 py-1.5"
            >
              <span className="mt-0.5 shrink-0">
                <StatusPill tone={getStepTone(step.status)}>
                  {step.status}
                </StatusPill>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{formatStepName(step.step)}</span>
                <span className="block opacity-85">{step.message}</span>
                {step.storeId || step.posId ? (
                  <span className="mt-0.5 block opacity-70">
                    {[step.storeId ? `Store ${step.storeId}` : null, step.posId ? `POS ${step.posId}` : null]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {result.technicalDetail ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold">
            Ver detalle tecnico
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
            {result.technicalDetail}
          </pre>
        </details>
      ) : null}
    </SettingsAlert>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-panel rounded-md px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function StatusPill({
  tone = "info",
  children
}: {
  tone?: "info" | "ok" | "warn" | "muted" | "error";
  children: ReactNode;
}) {
  const mappedTone = {
    info: "info",
    ok: "success",
    warn: "warning",
    muted: "neutral",
    error: "danger"
  } as const;

  return (
    <SettingsStatusBadge tone={mappedTone[tone]}>
      {children}
    </SettingsStatusBadge>
  );
}

function formatProviderStatusLabel(value: string) {
  return providerStatuses.find((status) => status.value === value)?.label ?? value;
}

function sortMercadoPagoAccountsForCustomer(
  left: MercadoPagoAccountView,
  right: MercadoPagoAccountView
) {
  if (left.defaultAccount !== right.defaultAccount) {
    return left.defaultAccount ? -1 : 1;
  }

  if (left.enabled !== right.enabled) {
    return left.enabled ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function getPreferredMercadoPagoMovementAccountId(
  accounts: MercadoPagoAccountView[]
) {
  return (
    accounts.find(
      (account) => account.environment === "PRODUCTION" && account.defaultAccount
    )?.id ??
    accounts.find((account) => account.environment === "PRODUCTION")?.id ??
    accounts.find(
      (account) => account.environment === "SANDBOX" && account.defaultAccount
    )?.id ??
    accounts.find((account) => account.environment === "SANDBOX")?.id ??
    ""
  );
}

function createInitialPosDraft(account: MercadoPagoAccountView): PosSetupDraft {
  return {
    storeName: account.storeName ?? "POS Universal",
    externalStoreId: account.externalStoreId ?? createDefaultExternalId("STORE", account.id),
    posName: account.posName ?? "Caja principal",
    externalPosId: account.externalPosId ?? createDefaultExternalId("POS", account.id),
    posCategory: account.posCategory ?? "",
    location: {
      streetName: "",
      streetNumber: "",
      cityName: "",
      stateName: "",
      latitude: "-34.92145",
      longitude: "-57.95453",
      reference: ""
    }
  };
}

function createDefaultExternalId(prefix: string, id: string) {
  const suffix = id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase() || "01";
  return `${prefix}${suffix}`.slice(0, 39);
}

function normalizeExternalDraft(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function getPosStatusLabel(status: string) {
  if (status === "ERROR" || status.endsWith("_ERROR")) {
    if (status === "STORE_ERROR") {
      return "Error creando sucursal";
    }
    if (status === "POS_ERROR") {
      return "Error creando caja";
    }
    return "Error";
  }
  if (status === "STORE_OK") {
    return "Sucursal creada";
  }
  if (status === "STORE_CREATED") {
    return "Sucursal creada, falta caja";
  }
  if (["CREATED", "EXISTING", "OK"].includes(status)) {
    return "Creada";
  }
  if (status === "PENDING") {
    return "Configurando";
  }
  return "Sin crear";
}

function getPosStatusTone(status: string): "ok" | "warn" | "muted" | "error" {
  if (status === "ERROR" || status.endsWith("_ERROR")) {
    return "error";
  }
  if (status === "STORE_OK" || status === "STORE_CREATED") {
    return "warn";
  }
  if (["CREATED", "EXISTING", "OK"].includes(status)) {
    return "ok";
  }
  if (status === "PENDING") {
    return "warn";
  }
  return "muted";
}

function getStepTone(status: string): "ok" | "warn" | "muted" | "error" {
  if (status === "ERROR") {
    return "error";
  }
  if (status === "NOT_FOUND") {
    return "warn";
  }
  if (status === "OK" || status === "EXISTING") {
    return "ok";
  }
  return "muted";
}

function formatStepName(step: string) {
  const labels: Record<string, string> = {
    DETECT_USER: "Usuario Mercado Pago",
    SEARCH_STORE: "Buscar sucursal",
    CREATE_STORE: "Crear sucursal",
    SEARCH_POS: "Buscar caja",
    CREATE_POS: "Crear caja",
    TEST_POS: "Probar caja"
  };
  return labels[step] ?? step;
}

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return <SettingsField label={label} className={className}>{children}</SettingsField>;
}

function HelpText({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-[var(--text-muted)]">{children}</p>;
}

function Feedback({
  tone,
  message
}: {
  tone: "warn" | "error" | "success";
  message: string;
}) {
  const mappedTone = {
    warn: "warning",
    error: "danger",
    success: "success"
  } as const;

  return (
    <SettingsAlert tone={mappedTone[tone]}>
      {message}
    </SettingsAlert>
  );
}

function sanitizeConfigMoneyInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const decimal = decimalParts.join("");

  return decimalParts.length > 0 ? `${whole}.${decimal.slice(0, 2)}` : whole;
}

function isTransferRecentRange(value: string | null): value is string {
  return Boolean(value && ["10", "30", "120", "today"].includes(value));
}

function isTransferRecentLimit(value: string | null): value is string {
  return Boolean(value && ["5", "10", "20"].includes(value));
}

function isTransferRefreshSeconds(value: string | null): value is string {
  return Boolean(value && ["0", "5", "10", "15"].includes(value));
}

function getOAuthFeedback(searchParams: { get: (name: string) => string | null }) {
  const status = searchParams.get("mp_oauth");
  if (status === "success" || status === "connected") {
    return {
      tone: "success" as const,
      message:
        searchParams.get("message") ||
        "Cuenta Mercado Pago conectada correctamente."
    };
  }

  if (status === "error") {
    return {
      tone: "error" as const,
      message:
        searchParams.get("message") ||
        "No se pudo completar la conexion Mercado Pago."
    };
  }

  return null;
}

function getOAuthDiagnosticsDetail(status: MercadoPagoOAuthConfigStatus) {
  return JSON.stringify(
    {
      configured: status.configured,
      missing: status.missing,
      clientIdConfigured: status.clientIdConfigured,
      clientIdPreview: status.clientIdPreview,
      redirectUri: status.redirectUri,
      authBaseUrl: status.authBaseUrl,
      callbackPath: status.callbackPath,
      platform_id: status.platformId,
      response_type: status.responseType,
      pkceEnabledLocal: status.pkceEnabledLocal,
      openMode: status.openMode,
      stateValidation: status.stateValidation,
      authorizationUrlPreview: status.authorizationUrlPreview,
      redirectUriWarnings: status.redirectUriWarnings,
      redirectUriExample: status.redirectUriExample,
      appPublicUrlConfigured: status.appPublicUrlConfigured,
      appPublicUrl: status.appPublicUrl,
      redirectBaseUsed: status.redirectBaseUsed,
      redirectBaseSource: status.redirectBaseSource,
      callbackSuccessRedirectPreview: status.callbackSuccessRedirectPreview,
      callbackErrorRedirectPreview: status.callbackErrorRedirectPreview,
      redirectUriConfigured: Boolean(status.redirectUri),
      required: ["MP_CLIENT_ID", "MP_CLIENT_SECRET", "MP_REDIRECT_URI"],
      secretValuesShown: false
    },
    null,
    2
  );
}

function formatTestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return formatStableArgentinaDateTime(date);
}

function runMercadoPagoMovementsRefresh({
  selectedAccountId,
  rangeValue,
  requiresReconnect,
  resetResult,
  startTransition,
  setResult,
  setLastQueryAt
}: {
  selectedAccountId: string;
  rangeValue: string;
  requiresReconnect: boolean;
  resetResult: boolean;
  startTransition: StartTransition;
  setResult: (result: MovementsResult | null) => void;
  setLastQueryAt: (value: string | null) => void;
}) {
  if (!selectedAccountId) {
    setResult({
      ok: false,
      movements: [],
      message: "Selecciona una cuenta Mercado Pago.",
      technicalDetail: null
    });
    return;
  }

  if (requiresReconnect) {
    const queriedAt = new Date().toISOString();
    setLastQueryAt(queriedAt);
    setResult({
      ok: false,
      movements: [],
      message: "La cuenta requiere reconexion OAuth antes de consultar cobros.",
      technicalDetail: null,
      queriedAt
    });
    return;
  }

  if (resetResult) {
    setResult(null);
  }

  const rangeMinutes = resolveMercadoPagoRangeMinutes(rangeValue);
  startTransition(async () => {
    try {
      const response = await fetch(
        `/api/mercadopago/accounts/${encodeURIComponent(selectedAccountId)}/payments/recent?rangeMinutes=${rangeMinutes}&limit=20&status=approved`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as MovementsResult;
      const queriedAt = data.queriedAt ?? new Date().toISOString();
      setLastQueryAt(queriedAt);
      setResult(data);
    } catch (error) {
      const queriedAt = new Date().toISOString();
      setLastQueryAt(queriedAt);
      setResult({
        ok: false,
        movements: [],
        message:
          error instanceof Error
            ? error.message
            : "Error al consultar Mercado Pago.",
        technicalDetail:
          error instanceof Error
            ? JSON.stringify({ message: error.message }, null, 2)
            : null,
        queriedAt
      });
    }
  });
}

function formatClock(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${padDatePart(argentinaTime.getUTCHours())}:${padDatePart(
    argentinaTime.getUTCMinutes()
  )}:${padDatePart(argentinaTime.getUTCSeconds())}`;
}

function resolveMercadoPagoRangeMinutes(value: string) {
  if (value === "today") {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return Math.max(1, Math.ceil((now.getTime() - startOfDay.getTime()) / 60000));
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 1440)) : 10;
}

function normalizeMercadoPagoSelectOption(
  value: number,
  options: number[],
  fallback: number
) {
  return String(options.includes(value) ? value : fallback);
}

function formatMovementDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return formatTestDate(value);
}

function formatMovementStatus(status: string | null | undefined) {
  const labels: Record<string, string> = {
    approved: "Aprobado",
    pending: "Pendiente",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    refunded: "Devuelto"
  };

  return labels[String(status ?? "").toLowerCase()] ?? status ?? "-";
}

function shortMercadoPagoId(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatStableArgentinaDateTime(date: Date) {
  const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return [
    `${padDatePart(argentinaTime.getUTCDate())}/${padDatePart(
      argentinaTime.getUTCMonth() + 1
    )}`,
    `${padDatePart(argentinaTime.getUTCHours())}:${padDatePart(
      argentinaTime.getUTCMinutes()
    )}`
  ].join(" ");
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}
