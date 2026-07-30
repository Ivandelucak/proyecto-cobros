import {
  FiscalConnectionMode,
  FiscalDocumentIdentityType,
  FiscalEnvironment,
  FiscalIssueMode,
  FiscalProviderVerificationStatus,
  type FiscalTaxTreatment,
  type FiscalCustomerCondition,
  type FiscalDocumentLetter,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FISCAL_SETTING_ID = "default";

type FiscalSettingsClient = Prisma.TransactionClient | typeof prisma;

export type FiscalSettingView = {
  exists: boolean;
  enabled: boolean;
  connectionMode: FiscalConnectionMode;
  delegationDeclaredAt: Date | null;
  providerVerificationStatus: FiscalProviderVerificationStatus;
  providerVerifiedAt: Date | null;
  providerLastVerificationAt: Date | null;
  providerLastErrorCode: string | null;
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
  defaultVatRate: string | null;
  defaultVatArcaCode: number | null;
  defaultTaxTreatment: FiscalTaxTreatment | null;
  hasArcaCertificatePem: boolean;
  hasArcaPrivateKeyPem: boolean;
  hasArcaWsaaToken: boolean;
  hasArcaWsaaSign: boolean;
  arcaTokenIsValid: boolean;
  arcaTokenExpiresAt: Date | null;
  arcaLastConnectionStatus: string | null;
  arcaLastConnectionTestAt: Date | null;
  arcaLastWsfeStatus: string | null;
  arcaLastWsfeTestAt: Date | null;
  arcaLastError: string | null;
};

export function getDefaultFiscalSetting(): FiscalSettingView {
  return {
    exists: false,
    enabled: false,
    connectionMode: FiscalConnectionMode.LEGACY_PER_BUSINESS,
    delegationDeclaredAt: null,
    providerVerificationStatus: FiscalProviderVerificationStatus.PENDING,
    providerVerifiedAt: null,
    providerLastVerificationAt: null,
    providerLastErrorCode: null,
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
    defaultCustomerDocType: FiscalDocumentIdentityType.CONSUMIDOR_FINAL,
    defaultVatRate: null,
    defaultVatArcaCode: null,
    defaultTaxTreatment: null,
    hasArcaCertificatePem: false,
    hasArcaPrivateKeyPem: false,
    hasArcaWsaaToken: false,
    hasArcaWsaaSign: false,
    arcaTokenIsValid: false,
    arcaTokenExpiresAt: null,
    arcaLastConnectionStatus: null,
    arcaLastConnectionTestAt: null,
    arcaLastWsfeStatus: null,
    arcaLastWsfeTestAt: null,
    arcaLastError: null
  };
}

export async function getFiscalSettingOrDefault(
  businessId?: string,
  client: FiscalSettingsClient = prisma
): Promise<FiscalSettingView> {
  if (!businessId) {
    return getDefaultFiscalSetting();
  }
  const setting = await client.fiscalSetting.findUnique({
    where: { businessId },
    select: {
      enabled: true,
      connectionMode: true,
      delegationDeclaredAt: true,
      providerVerificationStatus: true,
      providerVerifiedAt: true,
      providerLastVerificationAt: true,
      providerLastErrorCode: true,
      environment: true,
      cuit: true,
      legalName: true,
      fiscalCondition: true,
      pointOfSale: true,
      defaultInvoiceLetter: true,
      cashIssueMode: true,
      electronicPaymentIssueMode: true,
      currentAccountIssueMode: true,
      pendingWarningMinutes: true,
      pendingCriticalMinutes: true,
      allowCancelBeforeIssue: true,
      requireCustomerForInvoiceA: true,
      defaultCustomerDocType: true,
      defaultVatRate: true,
      defaultVatArcaCode: true,
      defaultTaxTreatment: true,
      arcaCertificatePem: true,
      arcaPrivateKeyPem: true,
      arcaWsaaToken: true,
      arcaWsaaSign: true,
      arcaTokenExpiresAt: true,
      arcaLastConnectionStatus: true,
      arcaLastConnectionTestAt: true,
      arcaLastWsfeStatus: true,
      arcaLastWsfeTestAt: true,
      arcaLastError: true
    }
  });

  if (!setting) {
    return getDefaultFiscalSetting();
  }

  return {
    exists: true,
    enabled: setting.enabled,
    connectionMode: setting.connectionMode,
    delegationDeclaredAt: setting.delegationDeclaredAt,
    providerVerificationStatus: setting.providerVerificationStatus,
    providerVerifiedAt: setting.providerVerifiedAt,
    providerLastVerificationAt: setting.providerLastVerificationAt,
    providerLastErrorCode: setting.providerLastErrorCode,
    environment: setting.environment,
    cuit: setting.cuit,
    legalName: setting.legalName,
    fiscalCondition: setting.fiscalCondition,
    pointOfSale: setting.pointOfSale,
    defaultInvoiceLetter: setting.defaultInvoiceLetter,
    cashIssueMode: setting.cashIssueMode,
    electronicPaymentIssueMode: setting.electronicPaymentIssueMode,
    currentAccountIssueMode: setting.currentAccountIssueMode,
    pendingWarningMinutes: setting.pendingWarningMinutes,
    pendingCriticalMinutes: setting.pendingCriticalMinutes,
    allowCancelBeforeIssue: setting.allowCancelBeforeIssue,
    requireCustomerForInvoiceA: setting.requireCustomerForInvoiceA,
    defaultCustomerDocType: setting.defaultCustomerDocType,
    defaultVatRate: setting.defaultVatRate?.toString() ?? null,
    defaultVatArcaCode: setting.defaultVatArcaCode,
    defaultTaxTreatment: setting.defaultTaxTreatment,
    hasArcaCertificatePem: Boolean(setting.arcaCertificatePem),
    hasArcaPrivateKeyPem: Boolean(setting.arcaPrivateKeyPem),
    hasArcaWsaaToken: Boolean(setting.arcaWsaaToken),
    hasArcaWsaaSign: Boolean(setting.arcaWsaaSign),
    arcaTokenIsValid: Boolean(
      setting.arcaWsaaToken &&
        setting.arcaWsaaSign &&
        setting.arcaTokenExpiresAt &&
        setting.arcaTokenExpiresAt.getTime() > Date.now()
    ),
    arcaTokenExpiresAt: setting.arcaTokenExpiresAt,
    arcaLastConnectionStatus: setting.arcaLastConnectionStatus,
    arcaLastConnectionTestAt: setting.arcaLastConnectionTestAt,
    arcaLastWsfeStatus: setting.arcaLastWsfeStatus,
    arcaLastWsfeTestAt: setting.arcaLastWsfeTestAt,
    arcaLastError: setting.arcaLastError
  };
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
