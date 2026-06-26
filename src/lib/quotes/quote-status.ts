import { QuoteStatus } from "@prisma/client";

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado"
};

export function quoteStatusTone(status: QuoteStatus): "green" | "red" | "amber" | "gray" | "blue" {
  if (status === QuoteStatus.APPROVED) {
    return "green";
  }

  if (status === QuoteStatus.REJECTED || status === QuoteStatus.CANCELLED) {
    return "red";
  }

  if (status === QuoteStatus.EXPIRED) {
    return "amber";
  }

  if (status === QuoteStatus.SENT) {
    return "blue";
  }

  return "gray";
}
