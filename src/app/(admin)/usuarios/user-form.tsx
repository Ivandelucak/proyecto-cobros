"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import type { UserFormState } from "./actions";

type UserFormValues = {
  name: string;
  email: string;
  role: "ADMIN" | "CASHIER";
  active: boolean;
};

type UserFormProps = {
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
  initialValues?: UserFormValues;
  submitLabel: string;
};

const initialState: UserFormState = {};

export function UserForm({ action, initialValues, submitLabel }: UserFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isEditing = Boolean(initialValues);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <Card className="p-5">
        <SectionTitle
          title="Datos de acceso"
          description="Define la identidad, rol y estado operativo del usuario."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={initialValues?.name ?? ""} required />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              name="email"
              defaultValue={initialValues?.email ?? ""}
              required
            />
          </Field>
          <Field label="Rol">
            <Select name="role" defaultValue={initialValues?.role ?? "CASHIER"}>
              <option value="ADMIN">Administrador</option>
              <option value="CASHIER">Cajero</option>
            </Select>
          </Field>
          <Field label={isEditing ? "Nueva contrasena" : "Contrasena"}>
            <Input
              type="password"
              name="password"
              minLength={6}
              required={!isEditing}
              placeholder={isEditing ? "Dejar vacio para no cambiar" : ""}
            />
          </Field>
          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initialValues?.active ?? true}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span>
              <span className="block font-medium text-gray-950 dark:text-gray-50">
                Usuario activo
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                Puede iniciar sesion y operar segun su rol.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <LinkButton href="/usuarios" variant="ghost">
          Cancelar
        </LinkButton>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Guardando..." : submitLabel}
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

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}
