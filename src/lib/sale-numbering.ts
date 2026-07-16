import { Prisma } from "@prisma/client";

export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

const periodFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARGENTINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit"
});

export type InternalSaleNumber = {
  internalPeriod: string;
  internalNumber: number;
};

export function getArgentinaSalePeriod(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new Error("La fecha de la venta es invalida para asignar su numeracion.");
  }

  const parts = Object.fromEntries(
    periodFormatter
      .formatToParts(value)
      .filter((part) => part.type === "year" || part.type === "month")
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}`;
}

export function formatInternalSaleNumber({
  internalPeriod,
  internalNumber
}: InternalSaleNumber): string {
  return `${internalPeriod}-${String(internalNumber).padStart(4, "0")}`;
}

export function parseInternalSaleNumber(value: string): InternalSaleNumber | null {
  const match = /^(\d{4}-\d{2})-(\d{1,9})$/.exec(value.trim().replace(/^#/, ""));
  if (!match) {
    return null;
  }

  const internalNumber = Number(match[2]);
  const month = Number(match[1].slice(5, 7));
  if (
    !Number.isSafeInteger(internalNumber) ||
    internalNumber < 1 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return { internalPeriod: match[1], internalNumber };
}

export async function allocateNextSaleNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  occurredAt: Date
): Promise<InternalSaleNumber> {
  const internalPeriod = getArgentinaSalePeriod(occurredAt);

  // Serializa solamente las altas del mismo comercio; otros comercios siguen en paralelo.
  const lockedBusinesses = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM Business WHERE id = ${businessId} FOR UPDATE`
  );
  if (lockedBusinesses.length === 0) {
    throw new Error("No se encontro el comercio para asignar la numeracion de venta.");
  }

  const sequence = await tx.saleNumberSequence.upsert({
    where: {
      businessId_period: {
        businessId,
        period: internalPeriod
      }
    },
    create: {
      businessId,
      period: internalPeriod,
      lastNumber: 1
    },
    update: {
      lastNumber: {
        increment: 1
      }
    },
    select: {
      lastNumber: true
    }
  });

  return {
    internalPeriod,
    internalNumber: sequence.lastNumber
  };
}
