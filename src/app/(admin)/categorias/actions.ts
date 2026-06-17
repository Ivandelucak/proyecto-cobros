"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CategoryFormState = {
  error?: string;
};

type ParsedCategoryForm = {
  name: string;
  parentId: string | null;
  active: boolean;
};

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireAdminUser();

  try {
    const data = await parseCategoryForm(formData);
    await validateCategoryName(data.name);

    await prisma.category.create({ data });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/categorias");
  redirect("/categorias");
}

export async function updateCategoryAction(
  categoryId: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireAdminUser();

  try {
    const data = await parseCategoryForm(formData, categoryId);
    await validateCategoryName(data.name, categoryId);

    await prisma.category.update({
      where: { id: categoryId },
      data
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/categorias");
  revalidatePath(`/categorias/${categoryId}/editar`);
  redirect("/categorias");
}

export async function setCategoryActiveAction(categoryId: string, active: boolean) {
  await requireAdminUser();

  await prisma.category.update({
    where: { id: categoryId },
    data: { active }
  });

  revalidatePath("/categorias");
}

async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.ADMIN) {
    redirect("/caja");
  }

  return user;
}

async function parseCategoryForm(
  formData: FormData,
  categoryId?: string
): Promise<ParsedCategoryForm> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  if (!name) {
    throw new Error("El nombre es obligatorio.");
  }

  if (parentId && parentId === categoryId) {
    throw new Error("Una categoría no puede ser padre de sí misma.");
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true }
    });

    if (!parent) {
      throw new Error("La categoría padre no existe.");
    }
  }

  return {
    name,
    parentId,
    active: formData.get("active") === "on"
  };
}

async function validateCategoryName(name: string, excludeId?: string) {
  const existing = await prisma.category.findFirst({
    where: {
      name,
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true }
  });

  if (existing) {
    throw new Error("Ya existe una categoría con ese nombre.");
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar la categoría.";
}
