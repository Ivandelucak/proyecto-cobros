import { FiscalDocumentStatus, FiscalStatus } from "@prisma/client";

export const fiscalStatusLabels: Record<FiscalStatus, string> = {
  NOT_REQUESTED: "Ticket interno",
  PENDING: "Pendiente de facturacion",
  READY_TO_ISSUE: "Factura preparada",
  ISSUED: "Emitida fiscalmente",
  FAILED: "Fallida",
  CANCELLED_BEFORE_ISSUE: "Anulada antes de emitir",
  CREDIT_NOTE_REQUIRED: "Requiere nota de credito",
  CANCELLED_BY_CREDIT_NOTE: "Anulada con nota de credito"
};

export const fiscalDocumentStatusLabels: Record<FiscalDocumentStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  ISSUED: "Emitida",
  FAILED: "Fallida",
  CANCELLED: "Cancelada",
  CREDIT_NOTE_PENDING: "Nota de credito pendiente",
  CREDIT_NOTE_ISSUED: "Nota de credito emitida"
};

export function isFiscalPendingStatus(status: FiscalStatus) {
  return (
    status === FiscalStatus.PENDING ||
    status === FiscalStatus.READY_TO_ISSUE ||
    status === FiscalStatus.FAILED
  );
}

export function isFiscalIssuedStatus(status: FiscalStatus) {
  return (
    status === FiscalStatus.ISSUED ||
    status === FiscalStatus.CREDIT_NOTE_REQUIRED ||
    status === FiscalStatus.CANCELLED_BY_CREDIT_NOTE
  );
}

export function fiscalStatusTone(status: FiscalStatus) {
  if (status === FiscalStatus.PENDING) {
    return "amber" as const;
  }

  if (status === FiscalStatus.READY_TO_ISSUE) {
    return "blue" as const;
  }

  if (
    status === FiscalStatus.ISSUED ||
    status === FiscalStatus.CANCELLED_BY_CREDIT_NOTE
  ) {
    return "green" as const;
  }

  if (
    status === FiscalStatus.FAILED ||
    status === FiscalStatus.CREDIT_NOTE_REQUIRED
  ) {
    return "red" as const;
  }

  return "gray" as const;
}
