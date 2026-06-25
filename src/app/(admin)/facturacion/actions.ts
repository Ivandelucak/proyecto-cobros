"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  markSaleFiscalNotRequested,
  prepareFiscalDocumentDraft
} from "@/lib/fiscal/fiscal-engine";
import {
  runArcaPreflightValidation,
  type ArcaPreflightResult
} from "@/lib/fiscal/arca/arca-preflight";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { prisma } from "@/lib/prisma";
import { cancelSale } from "@/lib/sale-cancellation";

export type FiscalActionState = {
  error?: string;
  success?: string;
};

export type ArcaPreflightActionState = {
  error?: string;
  result?: ArcaPreflightResult;
};

export async function prepareFiscalDocumentAction(
  saleId: string,
  _state: FiscalActionState,
  _formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();

  try {
    const document = await prepareFiscalDocumentDraft(saleId, user.id);
    await createAuditLog({
      userId: user.id,
      action: "FISCAL_DOCUMENT_PREPARED",
      entity: "FiscalDocument",
      entityId: document.id,
      description: "Preparo factura interna sin emitir a ARCA.",
      metadata: { saleId }
    });
    revalidateFiscalPaths(saleId);
    return { success: "Factura preparada, pendiente de envio real a ARCA." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function markFiscalNotRequestedAction(
  saleId: string,
  _state: FiscalActionState,
  _formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();

  try {
    await markSaleFiscalNotRequested(saleId, user.id);
    await createAuditLog({
      userId: user.id,
      action: "FISCAL_MARK_NOT_REQUESTED",
      entity: "Sale",
      entityId: saleId,
      description: "Marco venta como no solicitada fiscalmente."
    });
    revalidateFiscalPaths(saleId);
    return { success: "Venta marcada como ticket interno." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function cancelFiscalBeforeIssueAction(
  saleId: string,
  _state: FiscalActionState,
  formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    if (!reason) {
      throw new Error("El motivo es obligatorio.");
    }

    const result = await cancelSale({ saleId, userId: user.id, reason });
    await createAuditLog({
      userId: user.id,
      action:
        result.status === "credit_note_required"
          ? "FISCAL_CREDIT_NOTE_REQUIRED"
          : "FISCAL_CANCELLED_BEFORE_ISSUE",
      entity: "Sale",
      entityId: saleId,
      description:
        result.status === "credit_note_required"
          ? "Marco venta emitida como pendiente de nota de credito."
          : "Cancelo venta antes de emitir comprobante fiscal.",
      metadata: { reason }
    });
    revalidateFiscalPaths(saleId);
    return {
      success:
        result.status === "credit_note_required"
          ? "La venta ya fue emitida fiscalmente. Requiere nota de credito."
          : "Venta anulada antes de emitir comprobante fiscal."
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function executeArcaPreflightAction(
  saleId: string,
  _state: ArcaPreflightActionState,
  _formData: FormData
): Promise<ArcaPreflightActionState> {
  const user = await requireAdminPage();

  try {
    const [sale, setting] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          fiscalDocument: {
            include: {
              items: true
            }
          }
        }
      }),
      getFiscalSettingOrDefault()
    ]);

    const result = await runArcaPreflightValidation({
      sale,
      fiscalDocument: sale?.fiscalDocument ?? null,
      setting,
      requireConnectionCredentials: true
    });

    await createAuditLog({
      userId: user.id,
      action: result.canProceedToEmissionFuture
        ? "ARCA_PREFLIGHT_OK"
        : "ARCA_PREFLIGHT_FAILED",
      entity: "Sale",
      entityId: saleId,
      description: result.canProceedToEmissionFuture
        ? "Ejecuto preflight ARCA sin errores bloqueantes."
        : "Ejecuto preflight ARCA con errores bloqueantes.",
      metadata: {
        pointOfSale: result.pointOfSale,
        voucherType: result.voucherType,
        lastAuthorizedNumber: result.lastAuthorizedNumber,
        nextEstimatedNumber: result.nextEstimatedNumber,
        errors: result.errors,
        warnings: result.warnings
      }
    });

    revalidateFiscalPaths(saleId);

    return { result };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

function revalidateFiscalPaths(saleId: string) {
  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${saleId}`);
  revalidatePath(`/ventas/${saleId}`);
  revalidatePath(`/ventas/${saleId}/ticket`);
  revalidatePath("/ventas");
  revalidatePath("/admin");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la accion fiscal.";
}
