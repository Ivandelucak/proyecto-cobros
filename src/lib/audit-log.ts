import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditLogInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
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
