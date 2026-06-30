"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import type { CustomerFormState } from "./actions";

type CustomerFormProps = {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  submitLabel: string;
  initialValues?: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    fiscalCondition: string | null;
    docType: string | null;
    docNumber: string | null;
    businessName: string | null;
    taxAddress: string | null;
    notes: string | null;
    active: boolean;
  };
};

const initialState: CustomerFormState = {};
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
const fiscalDocumentTypeLabels = {
  "": "Sin especificar",
  DNI: "DNI",
  CUIT: "CUIT",
  CUIL: "CUIL",
  CDI: "CDI",
  PASAPORTE: "Pasaporte",
  CONSUMIDOR_FINAL: "Consumidor final",
  OTHER: "Otro"
};

export function CustomerForm({ action, submitLabel, initialValues }: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={initialValues?.name ?? ""} required />
          </Field>
          <Field label="Documento">
            <Input name="document" defaultValue={initialValues?.document ?? ""} />
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
          <label className="flex items-center gap-2 self-end rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-[#344457] dark:bg-[#121922] dark:text-[#A9B6C2]">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initialValues?.active ?? true}
              className="h-4 w-4 accent-brand-600"
            />
            Activo
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">
              Notas
            </span>
            <textarea
              name="notes"
              defaultValue={initialValues?.notes ?? ""}
              className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-[#344457] dark:bg-[#121922] dark:text-[#F3F7FA] dark:focus:ring-brand-900/60"
            />
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
          Datos fiscales
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Condicion fiscal">
            <Select
              name="fiscalCondition"
              defaultValue={initialValues?.fiscalCondition ?? ""}
            >
              {Object.entries(fiscalConditionLabels).map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de documento fiscal">
            <Select name="docType" defaultValue={initialValues?.docType ?? ""}>
              {Object.entries(fiscalDocumentTypeLabels).map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Numero documento fiscal">
            <Input name="docNumber" defaultValue={initialValues?.docNumber ?? ""} />
          </Field>
          <Field label="Razon social">
            <Input name="businessName" defaultValue={initialValues?.businessName ?? ""} />
          </Field>
          <Field label="Domicilio fiscal">
            <Input name="taxAddress" defaultValue={initialValues?.taxAddress ?? ""} />
          </Field>
        </div>
      </Card>

      {state.error ? <Message tone="error" text={state.error} /> : null}

      <div className="flex justify-end gap-2">
        <LinkButton href="/clientes">Cancelar</LinkButton>
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
      <span className="text-sm font-medium text-gray-700 dark:text-[#A9B6C2]">{label}</span>
      {children}
    </label>
  );
}

function Message({ tone, text }: { tone: "error"; text: string }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
      {text}
    </p>
  );
}
