import "server-only";

import { FiscalConnectionMode, FiscalEnvironment } from "@prisma/client";
import { ArcaError } from "@/lib/fiscal/arca/arca-errors";
import { getProviderCredentials } from "@/lib/fiscal/provider-credentials.server";
import { prisma } from "@/lib/prisma";

export type LegacyFiscalCredentials = {
  connectionMode: "LEGACY_PER_BUSINESS";
  fiscalSettingId: string;
  businessId: string;
  representedCuit: string;
  environment: FiscalEnvironment;
  pointOfSale: number | null;
  certificatePem: string;
  privateKeyPem: string;
  token: string | null;
  sign: string | null;
  tokenExpiresAt: Date | null;
};

export type ProviderDelegationCredentials = {
  connectionMode: "PROVIDER_DELEGATION";
  fiscalSettingId: string;
  businessId: string;
  representedCuit: string;
  environment: FiscalEnvironment;
  pointOfSale: number | null;
  certificatePem: string;
  privateKeyPem: string;
  certificateFingerprint: string;
  service: string;
};

export type ResolvedFiscalCredentials =
  | LegacyFiscalCredentials
  | ProviderDelegationCredentials;

export async function resolveFiscalCredentials(input: {
  businessId: string;
}): Promise<ResolvedFiscalCredentials> {
  const setting = await prisma.fiscalSetting.findUnique({
    where: { businessId: input.businessId },
    select: {
      id: true,
      businessId: true,
      connectionMode: true,
      environment: true,
      cuit: true,
      pointOfSale: true,
      arcaCertificatePem: true,
      arcaPrivateKeyPem: true,
      arcaWsaaToken: true,
      arcaWsaaSign: true,
      arcaTokenExpiresAt: true
    }
  });

  if (!setting) {
    throw new ArcaError("Falta configuración fiscal.");
  }

  const representedCuit = onlyDigits(setting.cuit);
  if (!/^\d{11}$/.test(representedCuit)) {
    throw new ArcaError("Falta un CUIT emisor válido.");
  }

  if (setting.connectionMode === FiscalConnectionMode.PROVIDER_DELEGATION) {
    const provider = getProviderCredentials();
    return {
      connectionMode: FiscalConnectionMode.PROVIDER_DELEGATION,
      fiscalSettingId: setting.id,
      businessId: setting.businessId,
      representedCuit,
      environment: provider.environment,
      pointOfSale: setting.pointOfSale,
      certificatePem: provider.certificatePem,
      privateKeyPem: provider.privateKeyPem,
      certificateFingerprint: provider.certificateFingerprint,
      service: provider.service
    };
  }

  if (!setting.arcaCertificatePem?.trim()) {
    throw new ArcaError("Falta certificado.");
  }
  if (!setting.arcaPrivateKeyPem?.trim()) {
    throw new ArcaError("Falta clave privada.");
  }

  // Security debt: legacy per-business PEM values remain unchanged for compatibility.
  // Provider credentials deliberately use environment-only storage and encrypted TA caching.
  return {
    connectionMode: FiscalConnectionMode.LEGACY_PER_BUSINESS,
    fiscalSettingId: setting.id,
    businessId: setting.businessId,
    representedCuit,
    environment: setting.environment,
    pointOfSale: setting.pointOfSale,
    certificatePem: setting.arcaCertificatePem,
    privateKeyPem: setting.arcaPrivateKeyPem,
    token: setting.arcaWsaaToken,
    sign: setting.arcaWsaaSign,
    tokenExpiresAt: setting.arcaTokenExpiresAt
  };
}

function onlyDigits(value: string | null): string {
  return value?.replace(/\D/g, "") ?? "";
}
