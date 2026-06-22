import { FiscalDocumentType } from "@prisma/client";

export { FiscalDocumentType };
export type { FiscalRequirementDecision } from "@/lib/fiscal/fiscal-policy";

export type FiscalIssueInput = {
  saleId?: string;
  fiscalDocumentId?: string;
  documentType?: FiscalDocumentType;
};

export type FiscalIssueResult = {
  success: boolean;
  documentType: FiscalDocumentType;
  message: string;
  error?: string;
};
