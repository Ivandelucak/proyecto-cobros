"use server";

import {
  FiscalCustomerCondition,
  FiscalDocumentIdentityType,
  FiscalDocumentLetter,
  FiscalEnvironment,
  FiscalIssueMode
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  FISCAL_SETTING_ID,
  normalizePendingMinutes,
  normalizePointOfSale
} from "@/lib/fiscal/fiscal-settings";
import { prisma } from "@/lib/prisma";

export type FiscalSettingsState = {
  error?: string;
  success?: string;
};

export async function updateFiscalSettingsAction(
  _prevState: FiscalSettingsState,
  formData: FormData
): Promise<FiscalSettingsState> {
  const user = await requireAdminPage();

  try {
    const pendingWarningMinutes = normalizePendingMinutes(
      readInt(formData, "pendingWarningMinutes", 30),
      30
    );
    const pendingCriticalMinutes = normalizePendingMinutes(
      readInt(formData, "pendingCriticalMinutes", 120),
      120
    );

    if (pendingCriticalMinutes < pendingWarningMinutes) {
      throw new Error("La alerta critica debe ser mayor o igual a la advertencia.");
    }

    const setting = await prisma.fiscalSetting.upsert({
      where: { id: FISCAL_SETTING_ID },
      update: {
        enabled: isChecked(formData, "enabled"),
        environment: parseEnum(
          formData.get("environment"),
          FiscalEnvironment,
          FiscalEnvironment.HOMOLOGACION
        ),
        cuit: readOptionalText(formData, "cuit"),
        legalName: readOptionalText(formData, "legalName"),
        fiscalCondition: parseOptionalEnum(formData.get("fiscalCondition"), FiscalCustomerCondition),
        pointOfSale: normalizePointOfSale(readOptionalInt(formData, "pointOfSale")),
        defaultInvoiceLetter: parseOptionalEnum(
          formData.get("defaultInvoiceLetter"),
          FiscalDocumentLetter
        ),
        cashIssueMode: parseEnum(
          formData.get("cashIssueMode"),
          FiscalIssueMode,
          FiscalIssueMode.ASK
        ),
        electronicPaymentIssueMode: parseEnum(
          formData.get("electronicPaymentIssueMode"),
          FiscalIssueMode,
          FiscalIssueMode.AUTO
        ),
        currentAccountIssueMode: parseEnum(
          formData.get("currentAccountIssueMode"),
          FiscalIssueMode,
          FiscalIssueMode.ASK
        ),
        pendingWarningMinutes,
        pendingCriticalMinutes,
        allowCancelBeforeIssue: isChecked(formData, "allowCancelBeforeIssue"),
        requireCustomerForInvoiceA: isChecked(formData, "requireCustomerForInvoiceA"),
        defaultCustomerDocType: parseEnum(
          formData.get("defaultCustomerDocType"),
          FiscalDocumentIdentityType,
          FiscalDocumentIdentityType.CONSUMIDOR_FINAL
        )
      },
      create: {
        id: FISCAL_SETTING_ID,
        enabled: isChecked(formData, "enabled"),
        environment: parseEnum(
          formData.get("environment"),
          FiscalEnvironment,
          FiscalEnvironment.HOMOLOGACION
        ),
        cuit: readOptionalText(formData, "cuit"),
        legalName: readOptionalText(formData, "legalName"),
        fiscalCondition: parseOptionalEnum(formData.get("fiscalCondition"), FiscalCustomerCondition),
        pointOfSale: normalizePointOfSale(readOptionalInt(formData, "pointOfSale")),
        defaultInvoiceLetter: parseOptionalEnum(
          formData.get("defaultInvoiceLetter"),
          FiscalDocumentLetter
        ),
        cashIssueMode: parseEnum(
          formData.get("cashIssueMode"),
          FiscalIssueMode,
          FiscalIssueMode.ASK
        ),
        electronicPaymentIssueMode: parseEnum(
          formData.get("electronicPaymentIssueMode"),
          FiscalIssueMode,
          FiscalIssueMode.AUTO
        ),
        currentAccountIssueMode: parseEnum(
          formData.get("currentAccountIssueMode"),
          FiscalIssueMode,
          FiscalIssueMode.ASK
        ),
        pendingWarningMinutes,
        pendingCriticalMinutes,
        allowCancelBeforeIssue: isChecked(formData, "allowCancelBeforeIssue"),
        requireCustomerForInvoiceA: isChecked(formData, "requireCustomerForInvoiceA"),
        defaultCustomerDocType: parseEnum(
          formData.get("defaultCustomerDocType"),
          FiscalDocumentIdentityType,
          FiscalDocumentIdentityType.CONSUMIDOR_FINAL
        )
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "FISCAL_SETTING_UPDATED",
      entity: "FiscalSetting",
      entityId: setting.id,
      description: "Actualizo configuracion fiscal preparatoria.",
      metadata: {
        enabled: setting.enabled,
        environment: setting.environment,
        pointOfSale: setting.pointOfSale
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/configuracion/fiscal");
    revalidatePath("/caja");
    revalidatePath("/facturacion");

    return { success: "Configuracion fiscal guardada." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuracion fiscal."
    };
  }
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  return readText(formData, key) || null;
}

function readInt(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(readText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalInt(formData: FormData, key: string) {
  const text = readText(formData, key);
  if (!text) {
    return null;
  }

  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : null;
}

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseEnum<T extends Record<string, string>>(
  value: FormDataEntryValue | null,
  values: T,
  fallback: T[keyof T]
) {
  const text = String(value ?? "");
  return Object.values(values).includes(text) ? (text as T[keyof T]) : fallback;
}

function parseOptionalEnum<T extends Record<string, string>>(
  value: FormDataEntryValue | null,
  values: T
) {
  const text = String(value ?? "");
  return Object.values(values).includes(text) ? (text as T[keyof T]) : null;
}
