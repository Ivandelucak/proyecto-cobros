"use server";

import { Role } from "@prisma/client";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function recordTicketPrintAction(input: {
  saleId: string;
  ok: boolean;
  error?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return;
    }

    const sale = await prisma.sale.findUnique({
      where: { id: input.saleId },
      select: {
        id: true,
        saleNumber: true,
        userId: true
      }
    });

    if (!sale) {
      return;
    }

    if (user.role !== Role.ADMIN && sale.userId !== user.id) {
      return;
    }

    await createAuditLog({
      userId: user.id,
      action: input.ok ? "TICKET_PRINTED" : "TICKET_PRINT_FAILED",
      entity: "Sale",
      entityId: sale.id,
      description: input.ok
        ? `Imprimio ticket de venta #${sale.saleNumber}.`
        : `Fallo la impresion del ticket de venta #${sale.saleNumber}.`,
      metadata: input.error ? { error: input.error } : undefined
    });
  } catch {
    // La auditoria de impresion no debe bloquear la operacion principal.
  }
}
