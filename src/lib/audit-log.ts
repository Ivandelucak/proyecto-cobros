import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditLogInput = {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: AuditLogInput) {
  try {
    let businessId = input.businessId;
    if (!businessId && input.userId) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { businessId: true }
      });
      businessId = user?.businessId;
    }

    await prisma.auditLog.create({
      data: {
        businessId: businessId || "default",
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata ?? undefined
      }
    });
  } catch {
    // La auditoria no debe bloquear la operacion principal.
  }
}
