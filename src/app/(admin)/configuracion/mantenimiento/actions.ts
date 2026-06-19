"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  assertValidBackupFilename,
  createJsonBackup,
  restoreJsonBackup
} from "@/lib/maintenance/backups";

export async function createBackupAction() {
  const user = await requireAdminPage();
  let successMessage = "";

  try {
    const backup = await createJsonBackup(user.id);

    await createAuditLog({
      userId: user.id,
      action: "BACKUP_CREATED",
      entity: "Maintenance",
      description: `Creo el backup ${backup.name}.`,
      metadata: {
        filename: backup.name,
        sizeBytes: backup.sizeBytes,
        type: "JSON"
      }
    });

    revalidatePath("/configuracion/mantenimiento");
    successMessage = `Backup creado: ${backup.name}`;
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "No se pudo crear el backup."
    );
  }

  redirectWithMessage("success", successMessage);
}

export async function restoreBackupAction(formData: FormData) {
  const user = await requireAdminPage();
  const filename = readText(formData, "filename");
  const confirmation = readText(formData, "confirmation");
  let safeFilename = "";

  try {
    safeFilename = assertValidBackupFilename(filename);

    await createAuditLog({
      userId: user.id,
      action: "BACKUP_RESTORE_ATTEMPT",
      entity: "Maintenance",
      description: `Intento restaurar el backup ${safeFilename}.`,
      metadata: {
        filename: safeFilename,
        confirmed: confirmation === "RESTAURAR"
      }
    });
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "No se pudo preparar la restauracion."
    );
  }

  if (confirmation !== "RESTAURAR") {
    redirectWithMessage("error", "Debes escribir RESTAURAR para continuar.");
  }

  let restoredFilename = safeFilename;

  try {
    const result = await restoreJsonBackup(safeFilename, user.id);
    restoredFilename = result.filename;
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "No se pudo restaurar el backup."
    );
  }

  revalidatePath("/");
  revalidatePath("/configuracion/mantenimiento");
  redirectWithMessage(
    "success",
    `Backup restaurado: ${restoredFilename}. Revisa usuarios, caja y stock antes de operar.`
  );
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/configuracion/mantenimiento?${params.toString()}`);
}
