import {
  FiscalDocumentType,
  type FiscalIssueInput,
  type FiscalIssueResult
} from "@/lib/fiscal/fiscal-types";

export async function issueFiscalDocumentPlaceholder(
  input: FiscalIssueInput
): Promise<FiscalIssueResult> {
  return {
    success: false,
    documentType: input.documentType ?? FiscalDocumentType.INVOICE,
    message: "ARCA no esta integrado en esta etapa."
  };
}
