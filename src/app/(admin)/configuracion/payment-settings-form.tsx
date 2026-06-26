"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/ui";
import type {
  CreditInstallmentPlanView,
  PaymentMethodSettingView
} from "@/lib/payment-settings";
import {
  updatePaymentSettingsAction,
  type PaymentSettingsState
} from "./actions";

type PaymentSettingsFormProps = {
  methods: PaymentMethodSettingView[];
  creditPlans: CreditInstallmentPlanView[];
};

type MethodCode = PaymentMethodSettingView["method"];

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
  MERCADOPAGO: "Cobro manual con alias, CVU o QR estatico, sin API real.",
  CURRENT_ACCOUNT: "Saldo cargado al cliente seleccionado en caja."
};

const providerStatuses = [
  { value: "", label: "Sin estado por defecto" },
  { value: "MANUAL_CONFIRMED", label: "Confirmado manualmente" },
  { value: "ACREDITADO", label: "Acreditado" },
  { value: "PENDING", label: "Pendiente" },
  { value: "AUTHORIZED", label: "Autorizado" }
];

const qrEnabledMethods = new Set<MethodCode>(["MERCADOPAGO"]);
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
  creditPlans
}: PaymentSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePaymentSettingsAction,
    initialState
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

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          title="Medios de pago manuales"
          description="Configura que ve el cajero, que datos puede copiar y si debe registrar una referencia."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {methods.map((method) => (
            <PaymentMethodCard
              key={method.method}
              method={method}
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
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:text-gray-400">
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

      {clientMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100">
          {clientMessage}
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar pagos"}
        </Button>
      </div>
    </form>
  );
}

function PaymentMethodCard({
  method,
  qrPreview,
  removedQr,
  onQrChange,
  onRemoveQr
}: {
  method: PaymentMethodSettingView;
  qrPreview: string | null;
  removedQr: boolean;
  onQrChange: (method: MethodCode, file: File | null) => void;
  onRemoveQr: (method: MethodCode) => void;
}) {
  const showAccountFields = accountFieldsMethods.has(method.method);
  const showBankFields = bankFieldsMethods.has(method.method);
  const showReference = referenceMethods.has(method.method);
  const showSurcharge = surchargeMethods.has(method.method);
  const showQr = qrEnabledMethods.has(method.method);

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-950",
        !method.enabled && "opacity-80"
      )}
    >
      <input
        type="hidden"
        name={`method-${method.method}-sortOrder`}
        value={method.sortOrder}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            {methodTitles[method.method]}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {methodDescriptions[method.method]}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            name={`method-${method.method}-enabled`}
            defaultChecked={method.enabled}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Activo
        </label>
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
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-gray-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
              <input
                type="checkbox"
                name={`method-${method.method}-askReference`}
                defaultChecked={method.askReference}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Pedir numero de operacion
            </label>
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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              QR estatico
            </p>
            <div className="mt-2 flex flex-col gap-3 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900">
                {qrPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrPreview} alt="QR Mercado Pago" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-xs text-gray-500 dark:text-gray-400">
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG o WebP. Maximo 2 MB.
                </p>
                {qrPreview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveQr(method.method)}
                  >
                    Quitar QR
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
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
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </span>
      {children}
    </label>
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
