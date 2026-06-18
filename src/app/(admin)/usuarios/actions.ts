"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UserFormState = {
  error?: string;
};

type ParsedUserForm = {
  name: string;
  email: string;
  role: Role;
  active: boolean;
  password: string;
};

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const currentUser = await requireAdminPage();

  try {
    const data = parseUserForm(formData, true);
    await validateUniqueEmail(data.email);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active,
        passwordHash: await hashPassword(data.password)
      }
    });

    await createAuditLog({
      userId: currentUser.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      description: `Creo el usuario ${user.email}.`,
      metadata: { role: user.role, active: user.active }
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateUserAction(
  userId: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const currentUser = await requireAdminPage();

  try {
    const data = parseUserForm(formData, false);
    await validateUniqueEmail(data.email, userId);
    await assertCanSaveUser(userId, data.role, data.active, currentUser.id);

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active,
        ...(data.password
          ? {
              passwordHash: await hashPassword(data.password)
            }
          : {})
      }
    });

    await createAuditLog({
      userId: currentUser.id,
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      description: `Actualizo el usuario ${data.email}.`,
      metadata: { role: data.role, active: data.active }
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${userId}/editar`);
  redirect("/usuarios");
}

export async function setUserActiveAction(userId: string, active: boolean) {
  const currentUser = await requireAdminPage();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true }
  });

  if (!user) {
    return;
  }

  await assertCanSaveUser(userId, user.role, active, currentUser.id);

  await prisma.user.update({
    where: { id: userId },
    data: { active }
  });

  await createAuditLog({
    userId: currentUser.id,
    action: active ? "REACTIVATE" : "DEACTIVATE",
    entity: "User",
    entityId: userId,
    description: `${active ? "Reactivo" : "Desactivo"} el usuario ${user.email}.`
  });

  revalidatePath("/usuarios");
}

function parseUserForm(formData: FormData, passwordRequired: boolean): ParsedUserForm {
  const name = readText(formData, "name");
  const email = readText(formData, "email").toLowerCase();
  const roleValue = readText(formData, "role");
  const password = readText(formData, "password");

  if (!name) {
    throw new Error("El nombre es obligatorio.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Ingresa un email valido.");
  }
  if (!Object.values(Role).includes(roleValue as Role)) {
    throw new Error("Rol invalido.");
  }
  if (passwordRequired && password.length < 6) {
    throw new Error("La contrasena debe tener al menos 6 caracteres.");
  }
  if (!passwordRequired && password && password.length < 6) {
    throw new Error("La nueva contrasena debe tener al menos 6 caracteres.");
  }

  return {
    name,
    email,
    role: roleValue as Role,
    active: formData.get("active") === "on",
    password
  };
}

async function validateUniqueEmail(email: string, excludeId?: string) {
  const existing = await prisma.user.findFirst({
    where: {
      email,
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true }
  });

  if (existing) {
    throw new Error("Ya existe un usuario con ese email.");
  }
}

async function assertCanSaveUser(
  userId: string,
  role: Role,
  active: boolean,
  currentUserId: string
) {
  if (!active && userId === currentUserId) {
    throw new Error("No podes desactivar tu usuario actual.");
  }

  if (role === Role.ADMIN && active) {
    return;
  }

  const activeAdmins = await prisma.user.count({
    where: {
      role: Role.ADMIN,
      active: true,
      NOT: { id: userId }
    }
  });

  if (activeAdmins === 0) {
    throw new Error("Debe quedar al menos un administrador activo.");
  }
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el usuario.";
}
