import {
  FiscalDocumentIdentityType,
  FiscalEnvironment,
  FiscalIssueMode,
  type FiscalCustomerCondition,
  type FiscalDocumentLetter,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FISCAL_SETTING_ID = "default";

type FiscalSettingsClient = Prisma.TransactionClient | typeof prisma;

export type FiscalSettingView = {
  enabled: boolean;
  environment: FiscalEnvironment;
  cuit: string | null;
  legalName: string | null;
  fiscalCondition: FiscalCustomerCondition | null;
  pointOfSale: number | null;
  defaultInvoiceLetter: FiscalDocumentLetter | null;
  cashIssueMode: FiscalIssueMode;
  electronicPaymentIssueMode: FiscalIssueMode;
  currentAccountIssueMode: FiscalIssueMode;
  pendingWarningMinutes: number;
  pendingCriticalMinutes: number;
  allowCancelBeforeIssue: boolean;
  requireCustomerForInvoiceA: boolean;
  defaultCustomerDocType: FiscalDocumentIdentityType;
};

export function getDefaultFiscalSetting(): FiscalSettingView {
  return {
    enabled: false,
    environment: FiscalEnvironment.HOMOLOGACION,
    cuit: null,
    legalName: null,
    fiscalCondition: null,
    pointOfSale: null,
    defaultInvoiceLetter: null,
    cashIssueMode: FiscalIssueMode.ASK,
    electronicPaymentIssueMode: FiscalIssueMode.AUTO,
    currentAccountIssueMode: FiscalIssueMode.ASK,
    pendingWarningMinutes: 30,
    pendingCriticalMinutes: 120,
    allowCancelBeforeIssue: true,
    requireCustomerForInvoiceA: true,
    defaultCustomerDocType: FiscalDocumentIdentityType.CONSUMIDOR_FINAL
  };
}

export async function getFiscalSettingOrDefault(
  client: FiscalSettingsClient = prisma
): Promise<FiscalSettingView> {
  const setting = await client.fiscalSetting.findUnique({
    where: { id: FISCAL_SETTING_ID }
  });

  return setting ?? getDefaultFiscalSetting();
}

export function normalizePendingMinutes(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 1440);
}

export function normalizePointOfSale(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 99999);
}
