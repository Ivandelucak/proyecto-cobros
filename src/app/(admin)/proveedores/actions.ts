"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export type SupplierFormState = {
  error?: string;
};

export async function createSupplierAction(
  _state: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  await requireAdminPage();

  try {
    await prisma.supplier.create({ data: parseSupplierForm(formData) });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}

export async function updateSupplierAction(
  supplierId: string,
  _state: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  await requireAdminPage();

  try {
    await prisma.supplier.update({
      where: { id: supplierId },
      data: parseSupplierForm(formData)
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${supplierId}`);
  redirect(`/proveedores/${supplierId}`);
}

export async function setSupplierActiveAction(supplierId: string, active: boolean) {
  await requireAdminPage();

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { active }
  });

  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${supplierId}`);
}

function parseSupplierForm(formData: FormData) {
  const name = readRequired(formData, "name");

  return {
    name,
    cuit: readOptional(formData, "cuit"),
    phone: readOptional(formData, "phone"),
    email: readOptional(formData, "email"),
    address: readOptional(formData, "address"),
    notes: readOptional(formData, "notes"),
    active: formData.get("active") === "on"
  };
}

function readRequired(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error("Completa los campos obligatorios.");
  }
  return value;
}

function readOptional(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el proveedor.";
}
