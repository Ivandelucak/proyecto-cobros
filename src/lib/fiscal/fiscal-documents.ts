import {
  FiscalCustomerCondition,
  FiscalDocumentLetter,
  FiscalDocumentStatus,
  FiscalDocumentType,
  FiscalStatus,
  SaleStatus,
  type Prisma
} from "@prisma/client";
import {
  getFiscalSettingOrDefault,
  type FiscalSettingView
} from "@/lib/fiscal/fiscal-settings";
import { prisma } from "@/lib/prisma";

type FiscalDocumentClient = Prisma.TransactionClient | typeof prisma;

type FiscalCustomerForDocument = {
  fiscalCondition: FiscalCustomerCondition | null;
  docType: unknown | null;
  docNumber: string | null;
  document: string | null;
};

export type FiscalReadinessResult = {
  errors: string[];
  warnings: string[];
};

export type FiscalDocumentTypeAndLetter = {
  type: FiscalDocumentType;
  letter: FiscalDocumentLetter;
};

export const fiscalDocumentTypeLabels: Record<FiscalDocumentType, string> = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de credito",
  DEBIT_NOTE: "Nota de debito"
};

export const fiscalDocumentLetterLabels: Record<FiscalDocumentLetter, string> = {
  A: "A",
  B: "B",
  C: "C",
  M: "M",
  E: "E"
};

export async function validateFiscalReadiness(
  saleId: string,
  client: FiscalDocumentClient = prisma
): Promise<FiscalReadinessResult> {
  const [setting, sale] = await Promise.all([
    getFiscalSettingOrDefault(client),
    client.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        fiscalDocument: {
          select: {
            status: true
          }
        }
      }
    })
  ]);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sale) {
    return {
      errors: ["Venta no encontrada."],
      warnings
    };
  }

  if (!setting.enabled) {
    warnings.push("El modulo fiscal esta deshabilitado.");
  }

  if (!setting.cuit) {
    warnings.push("Falta CUIT emisor en configuracion fiscal.");
  }

  if (!setting.pointOfSale) {
    warnings.push("Falta punto de venta en configuracion fiscal.");
  }

  if (!setting.fiscalCondition) {
    warnings.push("Falta condicion fiscal del comercio.");
  }

  if (sale.status === SaleStatus.CANCELLED) {
    errors.push("La venta esta cancelada.");
  }

  if (!sale.requiresFiscalInvoice) {
    errors.push("La venta no requiere factura fiscal.");
  }

  if (
    sale.fiscalStatus === FiscalStatus.ISSUED ||
    sale.fiscalStatus === FiscalStatus.CANCELLED_BY_CREDIT_NOTE ||
    sale.fiscalDocument?.status === FiscalDocumentStatus.ISSUED
  ) {
    errors.push("La venta ya fue emitida fiscalmente.");
  }

  if (sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED) {
    errors.push("La venta requiere nota de credito.");
  }

  const documentShape = determineFiscalDocumentTypeAndLetter({
    setting,
    customerCondition: sale.customer?.fiscalCondition ?? null
  });

  if (
    setting.requireCustomerForInvoiceA &&
    documentShape.letter === FiscalDocumentLetter.A &&
    sale.customer
  ) {
    if (!sale.customer.docNumber && !sale.customer.document) {
      warnings.push("El cliente no tiene documento fiscal cargado.");
    }
    if (!sale.customer.fiscalCondition) {
      warnings.push("El cliente no tiene condicion fiscal cargada.");
    }
  }

  return { errors, warnings };
}

export function determineFiscalDocumentTypeAndLetter(input: {
  setting: FiscalSettingView;
  customerCondition?: FiscalCustomerCondition | null;
}): FiscalDocumentTypeAndLetter {
  const { setting, customerCondition } = input;

  if (setting.fiscalCondition === FiscalCustomerCondition.MONOTRIBUTO) {
    return {
      type: FiscalDocumentType.INVOICE,
      letter: FiscalDocumentLetter.C
    };
  }

  if (setting.fiscalCondition === FiscalCustomerCondition.RESPONSABLE_INSCRIPTO) {
    return {
      type: FiscalDocumentType.INVOICE,
      letter:
        customerCondition === FiscalCustomerCondition.RESPONSABLE_INSCRIPTO
          ? FiscalDocumentLetter.A
          : FiscalDocumentLetter.B
    };
  }

  return {
    type: FiscalDocumentType.INVOICE,
    letter: setting.defaultInvoiceLetter ?? FiscalDocumentLetter.B
  };
}

export function hasFiscalCustomerDocument(customer: FiscalCustomerForDocument | null) {
  return Boolean(customer?.docNumber || customer?.document);
}
