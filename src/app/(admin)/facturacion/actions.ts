"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  markSaleFiscalNotRequested,
  prepareFiscalDocumentDraft
} from "@/lib/fiscal/fiscal-engine";
import { cancelSale } from "@/lib/sale-cancellation";

export type FiscalActionState = {
  error?: string;
  success?: string;
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
