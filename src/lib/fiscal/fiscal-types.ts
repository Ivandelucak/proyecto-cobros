export enum FiscalDocumentType {
  TICKET = "TICKET",
  INVOICE_A = "INVOICE_A",
  INVOICE_B = "INVOICE_B",
  INVOICE_C = "INVOICE_C"
}

export type FiscalIssueInput = {
  saleId: string;
  documentType: FiscalDocumentType;
};

export type FiscalIssueResult = {
  success: boolean;
  documentType: FiscalDocumentType;
  cae?: string;
  fiscalNumber?: string;
  message: string;
};
