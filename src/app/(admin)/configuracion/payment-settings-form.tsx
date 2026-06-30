"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { MercadoPagoAccountView } from "@/lib/mercadopago/mercado-pago-types";
import type {
  CreditInstallmentPlanView,
  PaymentMethodSettingView
} from "@/lib/payment-settings";
import { cn } from "@/lib/ui";
import {
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
  DEBIT: "Tarjeta de debito operada manualmente desde posnet.",
  CREDIT: "Tarjeta de credito con planes de cuotas configurados.",
  TRANSFER: "Datos bancarios visibles para confirmar transferencias manuales.",
  MERCADOPAGO: "Modo manual o QR dinamico por API.",
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

export function PaymentSettingsForm({
  methods,
  creditPlans,
  mercadoPagoAccounts
}: PaymentSettingsFormProps) {
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
  const activeAccounts = mercadoPagoAccounts.filter((account) => account.enabled).length;

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SectionTitle
            title="Medios de pago"
            description="Configura la operatoria visible en caja y las credenciales server-side para Mercado Pago."
          />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <SummaryBox label="Activos" value={String(enabledCount)} />
            <SummaryBox label="Cuentas MP" value={String(activeAccounts)} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Mercado Pago"
          description="Elegi si caja opera manualmente o con QR dinamico por API. Los tokens guardados no se muestran completos."
        />
        <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-[#273342] dark:bg-[#121922]">
            <p className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
              Modo de cobro
            </p>
            <div className="mt-3 grid gap-2">
              <ModeOption
                checked={mercadoPagoMode === "MANUAL"}
                title="Manual"
                description="Alias, CVU, referencia o QR estatico como respaldo."
                onChange={() => setMercadoPagoMode("MANUAL")}
              />
              <ModeOption
                checked={mercadoPagoMode === "API_QR"}
                title="API QR"
                description="Genera orden QR dinamica y confirma por polling."
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
          />
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Configuracion por metodo"
          description="Ajusta etiquetas, recargos, referencias e instrucciones de caja."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {methods.map((method) => (
            <PaymentMethodCard
              key={method.method}
              method={method}
              mercadoPagoMode={mercadoPagoMode}
              qrPreview={qrPreviews[method.method]}
              removedQr={Boolean(removedQr[method.method])}
              onQrChange={handleQrChange}
              onRemoveQr={removeQr}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Cuotas de credito"
          description="Los planes activos se usan automaticamente al cobrar con credito."
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:text-[#7F8D9A]">
              <tr>
                <th className="px-3 py-2 font-medium">Activo</th>
                <th className="px-3 py-2 font-medium">Cuotas</th>
                <th className="px-3 py-2 font-medium">Recargo %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {creditPlans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-3 py-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input
                      type="checkbox"
                      name={`plan-${plan.id}-active`}
                      defaultChecked={plan.active}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
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
              <tr>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    name="newActive"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
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
      </Card>

      {clientMessage ? <Feedback tone="warn" message={clientMessage} /> : null}
      {state.error ? <Feedback tone="error" message={state.error} /> : null}
      {state.success ? <Feedback tone="success" message={state.success} /> : null}

      <div className="sticky bottom-3 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-[#273342] dark:bg-[#121922]/95">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-[#A9B6C2]">
            Los cambios impactan en caja al guardar.
          </p>
          <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
            {pending ? "Guardando..." : "Guardar pagos"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function MercadoPagoAccountsPanel({
  accounts,
  mercadoPagoMode
}: {
  accounts: MercadoPagoAccountView[];
  mercadoPagoMode: MercadoPagoMode;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-950 dark:border-brand-900/70 dark:bg-brand-950/30 dark:text-brand-100">
        Para QR dinamico necesitas cargar el Access Token y crear una caja/POS Mercado Pago. El QR se genera por cada venta y se envia con el external_pos_id de esa caja.
      </p>
      {mercadoPagoMode === "API_QR" && accounts.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          Agrega una cuenta para generar QR dinamico.
        </p>
      ) : null}
      {accounts.map((account) => (
        <MercadoPagoAccountCard key={account.id} account={account} />
      ))}
      <MercadoPagoNewAccountCard hasExistingAccounts={accounts.length > 0} />
    </div>
  );
}

function MercadoPagoAccountCard({ account }: { account: MercadoPagoAccountView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPosPending, startPosTransition] = useTransition();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [posResult, setPosResult] = useState<PosSetupResult | null>(null);
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

  return (
    <details
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#273342] dark:bg-[#121922]"
      open={account.defaultAccount}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-gray-950 dark:text-[#F3F7FA]">
                {account.name}
              </p>
              <StatusPill tone={account.enabled ? "ok" : "muted"}>
                {account.enabled ? "Activa" : "Inactiva"}
              </StatusPill>
              {account.defaultAccount ? <StatusPill>Predeterminada</StatusPill> : null}
              <StatusPill tone={account.enableAmountMatching ? "warn" : "muted"}>
                Match {account.enableAmountMatching ? "activo" : "no"}
              </StatusPill>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-[#7F8D9A]">
              {account.environment} - {account.hasAccessToken ? "Token cargado" : "Sin token"}
              {detectedCollectorId ? ` - Cuenta ${detectedCollectorId}` : ""}
              {testResult?.testedAt ? ` - Ultima prueba ${formatTestDate(testResult.testedAt)}` : ""}
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
            <span className="inline-flex min-h-8 items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-[#344457] dark:text-[#A9B6C2]">
              Editar
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-[#273342]">
        <input type="hidden" name="mpAccountId" value={account.id} />
        <input
          type="hidden"
          name={`mp-${account.id}-externalPosId`}
          value={posResult?.ok ? posResult.externalPosId : account.externalPosId ?? ""}
          readOnly
        />
        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre de cuenta">
            <Input name={`mp-${account.id}-name`} defaultValue={account.name} required />
          </Field>
          <Field label="Entorno">
            <Select name={`mp-${account.id}-environment`} defaultValue={account.environment}>
              <option value="SANDBOX">Sandbox</option>
              <option value="PRODUCTION">Produccion</option>
            </Select>
            <HelpText>Usa Sandbox para pruebas y Produccion para cobros reales.</HelpText>
          </Field>
          <Field label="Access Token" className="md:col-span-2">
            <Input
              type="password"
              name={`mp-${account.id}-accessToken`}
              placeholder={account.hasAccessToken ? "Conservar token cargado" : "Access Token"}
              autoComplete="off"
            />
            <HelpText>
              Pega el Access Token de Mercado Pago Developers. No se muestra completo despues de guardar.
            </HelpText>
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
            <CheckLine name={`mp-${account.id}-deleteAccount`} tone="danger">
              Desactivar cuenta
            </CheckLine>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#273342] dark:bg-[#18212B]/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Caja Mercado Pago
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-[#7F8D9A]">
                Mercado Pago requiere una caja/POS para generar QR. El external_pos_id se envia en cada orden.
              </p>
            </div>
            <StatusPill tone={getPosStatusTone(visiblePosStatus)}>
              {getPosStatusLabel(visiblePosStatus)}
            </StatusPill>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-gray-600 dark:text-[#A9B6C2] sm:grid-cols-2 xl:grid-cols-5">
            <MetaLine label="Sucursal external_id" value={visibleStoreExternalId} />
            <MetaLine label="Store ID" value={visibleStoreId} />
            <MetaLine label="Caja external_id" value={visiblePosExternalId} />
            <MetaLine label="POS ID" value={visiblePosId} />
            <MetaLine
              label="Ultimo setup"
              value={account.lastPosSetupAt ? formatTestDate(account.lastPosSetupAt) : "-"}
            />
          </div>

          {account.lastPosSetupError && !posResult ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
              {account.lastPosSetupError}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
              <HelpText>Solo letras y numeros. Sin espacios ni guiones.</HelpText>
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
              <HelpText>Es el valor que se envia como config.qr.external_pos_id.</HelpText>
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
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={isPosPending || !account.hasAccessToken}
              onClick={setupPos}
            >
              {isPosPending
                ? "Configurando..."
                : hasStoreWithoutPos
                  ? "Reintentar caja"
                  : "Crear sucursal y caja"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPosPending || !account.hasAccessToken}
              onClick={testPos}
            >
              {isPosPending ? "Probando..." : "Probar caja"}
            </Button>
          </div>
          {isPosPending ? (
            <p className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 dark:border-brand-900/70 dark:bg-brand-950/30 dark:text-brand-100">
              Creando sucursal y validando store_id antes de crear la caja...
            </p>
          ) : null}
          {posResult ? <PosSetupResultBox result={posResult} /> : null}
        </section>

        <AdvancedOptions title="Opciones avanzadas">
          <div className="grid gap-3 md:grid-cols-2">
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
            <Field label="Ventana match (min)">
              <Input
                type="number"
                min={1}
                max={60}
                step={1}
                name={`mp-${account.id}-amountMatchingWindowMinutes`}
                defaultValue={account.amountMatchingWindowMinutes}
              />
            </Field>
            <Field label="Tolerancia match">
              <Input
                inputMode="decimal"
                name={`mp-${account.id}-amountMatchingTolerance`}
                defaultValue={account.amountMatchingTolerance}
              />
            </Field>
            <Field label="Frecuencia busqueda (seg)">
              <Input
                type="number"
                min={15}
                max={300}
                step={1}
                name={`mp-${account.id}-amountMatchingPollSeconds`}
                defaultValue={account.amountMatchingPollSeconds}
              />
              <HelpText>Minimo 15 segundos para evitar consultas repetidas.</HelpText>
            </Field>
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <CheckLine
                name={`mp-${account.id}-enableAmountMatching`}
                defaultChecked={account.enableAmountMatching}
              >
                Habilitar match por monto
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
            <p className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              El match por monto es una ayuda manual para detectar pagos recientes por el mismo importe. No reemplaza al QR dinamico. Si activas autoasociacion, revisa que la tolerancia sea 0 o muy baja.
            </p>
            <p className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
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
    <details className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900/70 dark:bg-brand-950/20" open>
      <summary className="cursor-pointer list-none">
        <div>
          <p className="font-semibold text-gray-950 dark:text-[#F3F7FA]">
            Agregar cuenta Mercado Pago
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">
            Configuracion basica para publicar QR dinamico en pocos pasos.
          </p>
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
          <p className="md:col-span-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-gray-600 dark:border-[#273342] dark:bg-[#121922] dark:text-[#A9B6C2]">
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
              <Input
                type="number"
                min={1}
                max={60}
                step={1}
                name="newMp-amountMatchingWindowMinutes"
                defaultValue={10}
              />
            </Field>
            <Field label="Tolerancia match">
              <Input inputMode="decimal" name="newMp-amountMatchingTolerance" defaultValue="0" />
            </Field>
            <Field label="Frecuencia busqueda (seg)">
              <Input
                type="number"
                min={15}
                max={300}
                step={1}
                name="newMp-amountMatchingPollSeconds"
                defaultValue={20}
              />
              <HelpText>Minimo 15 segundos para evitar consultas repetidas.</HelpText>
            </Field>
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <CheckLine name="newMp-enableAmountMatching">Habilitar match por monto</CheckLine>
              <CheckLine name="newMp-amountMatchingAutoApprove">
                Autoasociar matches exactos
              </CheckLine>
              <CheckLine name="newMp-showRecentMovements" defaultChecked>
                Mostrar movimientos recientes en caja
              </CheckLine>
            </div>
            <p className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              El match por monto es una ayuda manual para detectar pagos recientes por el mismo importe. No reemplaza al QR dinamico. Autoasociar matches exactos queda desactivado por defecto.
            </p>
            <p className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
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

function PaymentMethodCard({
  method,
  mercadoPagoMode,
  qrPreview,
  removedQr,
  onQrChange,
  onRemoveQr
}: {
  method: PaymentMethodSettingView;
  mercadoPagoMode: MercadoPagoMode;
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
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-[#273342] dark:bg-[#121922]",
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
            {methodTitles[method.method]}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#7F8D9A]">
            {methodDescriptions[method.method]}
          </p>
        </div>
        <CheckLine name={`method-${method.method}-enabled`} defaultChecked={method.enabled}>
          Activo
        </CheckLine>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Nombre visible">
          <Input
            name={`method-${method.method}-label`}
            defaultValue={method.label}
            required
          />
        </Field>

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

        {showBankFields ? (
          <Field label="Banco">
            <Input name={`method-${method.method}-bankName`} defaultValue={method.bankName ?? ""} />
          </Field>
        ) : null}

        {showAccountFields ? (
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

        <Field label="Instrucciones" className="md:col-span-2">
          <Textarea
            name={`method-${method.method}-instructions`}
            defaultValue={method.instructions ?? ""}
            rows={3}
            placeholder="Texto breve visible para el cajero."
          />
        </Field>

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
            <p className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              QR estatico manual
            </p>
            <div className="mt-2 flex flex-col gap-3 rounded-md border border-slate-300 bg-white p-3 dark:border-[#344457] dark:bg-[#121922] sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-[#273342] dark:bg-[#18212B]">
                {qrPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrPreview} alt="QR Mercado Pago" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-xs text-gray-500 dark:text-[#7F8D9A]">
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
                <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
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
    </div>
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
        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition",
        checked
          ? "border-brand-500 bg-brand-50 text-brand-950 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-100"
          : "border-slate-200 bg-white text-gray-700 hover:border-slate-300 dark:border-[#273342] dark:bg-[#121922] dark:text-[#A9B6C2]"
      )}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
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
    <label
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm",
        tone === "danger"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"
          : "border-slate-300 bg-white text-gray-700 dark:border-[#344457] dark:bg-[#18212B] dark:text-[#A9B6C2]"
      )}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      {children}
    </label>
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
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-gray-700 dark:border-[#344457] dark:bg-[#18212B] dark:text-[#A9B6C2]">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      {children}
    </label>
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
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#273342] dark:bg-[#18212B]/60">
      <summary className="cursor-pointer text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function TestResultBox({ result }: { result: TestResult }) {
  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-sm",
        result.ok
          ? "border-[#BFE3D2] bg-[#E8F6EF] text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100"
      )}
    >
      <p className="font-semibold">{result.ok ? "Conexion OK" : "No se pudo conectar"}</p>
      <p className="mt-1">{result.message}</p>
      {result.nickname || result.email || result.testedAt ? (
        <p className="mt-1 text-xs opacity-80">
          {[result.nickname, result.email, result.testedAt ? formatTestDate(result.testedAt) : null]
            .filter(Boolean)
            .join(" - ")}
        </p>
      ) : null}
    </div>
  );
}

function PosSetupResultBox({ result }: { result: PosSetupResult }) {
  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-sm",
        result.ok
          ? "border-[#BFE3D2] bg-[#E8F6EF] text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100"
      )}
    >
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
              className="flex items-start gap-2 rounded-md border border-current/15 bg-white/45 px-2 py-1.5 dark:bg-[#121922]/35"
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
          <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-4 text-slate-700 dark:border-[#273342] dark:bg-[#121922] dark:text-[#A9B6C2]">
            {result.technicalDetail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-[#273342] dark:bg-[#121922]">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-[#7F8D9A]">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-gray-800 dark:text-[#F3F7FA]">
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
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone === "info" &&
          "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/70 dark:bg-brand-950/30 dark:text-brand-200",
        tone === "ok" &&
          "border-[#BFE3D2] bg-[#E8F6EF] text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]",
        tone === "warn" &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
        tone === "error" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100",
        tone === "muted" &&
          "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#273342] dark:bg-[#18212B] dark:text-[#A9B6C2]"
      )}
    >
      {children}
    </span>
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
  return (
    <label className={cn("space-y-2", className)}>
      <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
        {label}
      </span>
      {children}
    </label>
  );
}

function HelpText({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-5 text-gray-500 dark:text-[#7F8D9A]">{children}</p>;
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
      <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">{title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">{description}</p>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#273342] dark:bg-[#121922]">
      <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">{label}</p>
      <p className="text-lg font-bold text-gray-950 dark:text-[#F3F7FA]">{value}</p>
    </div>
  );
}

function Feedback({
  tone,
  message
}: {
  tone: "warn" | "error" | "success";
  message: string;
}) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "warn" &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100",
        tone === "error" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200",
        tone === "success" &&
          "border-[#BFE3D2] bg-[#E8F6EF] text-[#1F8F63] dark:border-[#28A36A]/55 dark:bg-[#28A36A]/14 dark:text-[#D4F2E1]"
      )}
    >
      {message}
    </p>
  );
}

function formatTestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
