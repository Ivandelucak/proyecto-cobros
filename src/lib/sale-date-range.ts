import { Prisma } from "@prisma/client";
import type { ArgentinaDateRange } from "@/lib/date-format";

export function buildOperationalSaleDateWhere(
  range: Pick<ArgentinaDateRange, "startUtc" | "endUtcExclusive">
): Prisma.SaleWhereInput {
  const dateRange = { gte: range.startUtc, lt: range.endUtcExclusive };

  // Sale.occurredAt is required in the current schema. It is set on normal and
  // offline sales, so createdAt remains insertion metadata rather than a date filter.
  return {
    occurredAt: dateRange
  };
}
