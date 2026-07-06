"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  parsePrintPaperSize,
  updatePrintSetting,
  type PrintSettingView
} from "@/lib/print-settings";

export type PrintSettingsState = {
  error?: string;
  success?: string;
};

export async function updatePrintSettingsAction(
  _prevState: PrintSettingsState,
  formData: FormData
): Promise<PrintSettingsState> {
  const user = await requireAdminPage();

  try {
    const printerName = readOptionalText(formData, "printerName");
    const silentPrint = formData.get("silentPrint") === "on";

    if (silentPrint && !printerName) {
      throw new Error("La impresion silenciosa requiere una impresora seleccionada.");
    }

    const setting: PrintSettingView = {
      printerName,
      paperSize: parsePrintPaperSize(formData.get("paperSize")),
      silentPrint,
      autoPrintTicket: formData.get("autoPrintTicket") === "on",
      copies: clampInt(readInt(formData, "copies", 1), 1, 5),
      marginMm: clampInt(readInt(formData, "marginMm", 2), 0, 12)
    };

    await updatePrintSetting(user.businessId!, setting);

    await createAuditLog({
      userId: user.id,
      action: "PRINT_SETTINGS_UPDATED",
      entity: "PrintSetting",
      entityId: "default",
      description: "Actualizo la configuracion de impresion.",
      metadata: {
        printerName: setting.printerName,
        paperSize: setting.paperSize,
        silentPrint: setting.silentPrint,
        autoPrintTicket: setting.autoPrintTicket,
        copies: setting.copies,
        marginMm: setting.marginMm
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/configuracion/impresion");
    revalidatePath("/caja");

    return { success: "Configuracion de impresion guardada." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuracion de impresion."
    };
  }
}

function readOptionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value && value !== "__none" ? value : null;
}

function readInt(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isFinite(value) ? value : fallback;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
