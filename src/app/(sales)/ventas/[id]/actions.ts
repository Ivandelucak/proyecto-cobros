"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { cancelSale } from "@/lib/sale-cancellation";

export type CancelSaleState = {
  error?: string;
  success?: string;
};

export async function cancelSaleAction(
  saleId: string,
  _prevState: CancelSaleState,
  formData: FormData
): Promise<CancelSaleState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "No autorizado." };
  }

  try {
    const result = await cancelSale({
      saleId,
      userId: user.id,
      reason: String(formData.get("reason") ?? "")
    });

    if (result.status === "credit_note_required") {
      await createAuditLog({
        userId: user.id,
        action: "FISCAL_CREDIT_NOTE_REQUIRED",
        entity: "Sale",
        entityId: saleId,
        description: "Marco una venta emitida como pendiente de nota de credito.",
        metadata: { reason: String(formData.get("reason") ?? "").trim() }
      });

      revalidatePath(`/ventas/${saleId}`);
      revalidatePath(`/ventas/${saleId}/ticket`);
      revalidatePath("/ventas");
      revalidatePath("/facturacion");

      return {
        success:
          "La venta ya fue emitida fiscalmente. Requiere nota de credito."
      };
    }

    await createAuditLog({
      userId: user.id,
      action: "CANCEL",
      entity: "Sale",
      entityId: saleId,
      description: "Anulo una venta.",
      metadata: { reason: String(formData.get("reason") ?? "").trim() }
    });

    revalidatePath(`/ventas/${saleId}`);
    revalidatePath(`/ventas/${saleId}/ticket`);
    revalidatePath("/ventas");
    revalidatePath("/caja");
    revalidatePath("/reportes");
    revalidatePath("/admin");
    revalidatePath("/productos");

    redirect(`/ventas/${saleId}`);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo anular la venta."
    };
  }
}
