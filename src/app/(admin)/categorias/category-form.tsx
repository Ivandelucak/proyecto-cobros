"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import type { CategoryFormState } from "./actions";

type CategoryOption = {
  id: string;
  name: string;
};

type CategoryFormValues = {
  name?: string;
  parentId?: string | null;
  active?: boolean;
};

type CategoryFormProps = {
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  parentOptions: CategoryOption[];
  initialValues?: CategoryFormValues;
  submitLabel: string;
};

const initialState: CategoryFormState = {};

export function CategoryForm({
  action,
  parentOptions,
  initialValues,
  submitLabel
}: CategoryFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Nombre
            </span>
            <Input name="name" defaultValue={initialValues?.name ?? ""} required />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Categoría padre
            </span>
            <Select name="parentId" defaultValue={initialValues?.parentId ?? ""}>
              <option value="">Sin categoría padre</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200">
              <input
                type="checkbox"
                name="active"
                defaultChecked={initialValues?.active ?? true}
                className="h-4 w-4 accent-brand-600"
              />
              Activa
            </label>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <LinkButton href="/categorias">Cancelar</LinkButton>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
