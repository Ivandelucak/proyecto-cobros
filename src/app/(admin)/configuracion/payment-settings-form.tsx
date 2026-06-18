"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const initialState: PaymentSettingsState = {};

export function PaymentSettingsForm({
  methods,
  creditPlans
}: PaymentSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePaymentSettingsAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          title="Medios de pago"
          description="Define que opciones aparecen en caja y con que nombre."
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Activo</th>
                <th className="px-3 py-2 font-medium">Medio</th>
                <th className="px-3 py-2 font-medium">Etiqueta</th>
                <th className="px-3 py-2 font-medium">Orden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {methods.map((method) => (
                <tr key={method.method}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      name={`method-${method.method}-enabled`}
                      defaultChecked={method.enabled}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-950 dark:text-gray-50">
                    {method.method}
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      name={`method-${method.method}-label`}
                      defaultValue={method.label}
                      required
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      name={`method-${method.method}-sortOrder`}
                      defaultValue={method.sortOrder}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle
          title="Cuotas de credito"
          description="Los recargos activos se usan automaticamente al cobrar con credito."
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

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="min-w-44" disabled={pending}>
          {pending ? "Guardando..." : "Guardar pagos"}
        </Button>
      </div>
    </form>
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
