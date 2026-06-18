"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import type { SupplierFormState } from "./actions";

type SupplierFormProps = {
  action: (state: SupplierFormState, formData: FormData) => Promise<SupplierFormState>;
  submitLabel: string;
  initialValues?: {
    name: string;
    cuit: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    active: boolean;
  };
};

const initialState: SupplierFormState = {};

export function SupplierForm({ action, submitLabel, initialValues }: SupplierFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={initialValues?.name ?? ""} required />
          </Field>
          <Field label="CUIT">
            <Input name="cuit" defaultValue={initialValues?.cuit ?? ""} />
          </Field>
          <Field label="Telefono">
            <Input name="phone" defaultValue={initialValues?.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={initialValues?.email ?? ""} />
          </Field>
          <Field label="Direccion">
            <Input name="address" defaultValue={initialValues?.address ?? ""} />
          </Field>
          <label className="flex items-center gap-2 self-end rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initialValues?.active ?? true}
              className="h-4 w-4 accent-brand-600"
            />
            Activo
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Notas
            </span>
            <textarea
              name="notes"
              defaultValue={initialValues?.notes ?? ""}
              className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-50 dark:focus:ring-brand-900/60"
            />
          </label>
        </div>
      </Card>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <LinkButton href="/proveedores">Cancelar</LinkButton>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}
