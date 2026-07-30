import "server-only";

import { createHash } from "node:crypto";
import forge from "node-forge";
import { FiscalEnvironment } from "@prisma/client";
import { ArcaError } from "@/lib/fiscal/arca/arca-errors";
import { ARCA_WSAA_SERVICE } from "@/lib/fiscal/arca/arca-config";
import { assertProviderTokenEncryptionReady } from "@/lib/fiscal/provider-token-crypto.server";

export type ProviderCredentials = {
  providerCuit: string;
  certificatePem: string;
  privateKeyPem: string;
  environment: FiscalEnvironment;
  service: typeof ARCA_WSAA_SERVICE;
  certificateFingerprint: string;
};

export type ProviderCredentialsPublicStatus = {
  configured: boolean;
  providerCuit: string | null;
};

export function getProviderCredentials(): ProviderCredentials {
  const providerCuit = onlyDigits(process.env.ARCA_PROVIDER_CUIT);
  const environment = parseEnvironment(process.env.ARCA_PROVIDER_ENVIRONMENT);
  const certificatePem = decodePem(process.env.ARCA_PROVIDER_CERTIFICATE_B64);
  const privateKeyPem = decodePem(process.env.ARCA_PROVIDER_PRIVATE_KEY_B64);

  if (!/^\d{11}$/.test(providerCuit)) {
    throw new ArcaError("La configuración del prestador no está disponible.");
  }

  try {
    forge.pki.certificateFromPem(certificatePem);
    forge.pki.privateKeyFromPem(privateKeyPem);
  } catch {
    throw new ArcaError("La configuración del prestador no está disponible.");
  }

  return {
    providerCuit,
    certificatePem,
    privateKeyPem,
    environment,
    service: ARCA_WSAA_SERVICE,
    certificateFingerprint: createHash("sha256").update(certificatePem).digest("hex")
  };
}

export function getProviderCredentialsPublicStatus(): ProviderCredentialsPublicStatus {
  try {
    const credentials = getProviderCredentials();
    assertProviderTokenEncryptionReady();
    return { configured: true, providerCuit: credentials.providerCuit };
  } catch {
    return { configured: false, providerCuit: null };
  }
}

function parseEnvironment(value: string | undefined): FiscalEnvironment {
  if (value === FiscalEnvironment.HOMOLOGACION || value === FiscalEnvironment.PRODUCCION) {
    return value;
  }

  throw new ArcaError("La configuración del prestador no está disponible.");
}

function decodePem(value: string | undefined): string {
  const normalized = value?.replace(/\s+/g, "") ?? "";

  if (
    !normalized ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw new ArcaError("La configuración del prestador no está disponible.");
  }

  const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();
  if (!decoded.includes("-----BEGIN") || !decoded.includes("-----END")) {
    throw new ArcaError("La configuración del prestador no está disponible.");
  }

  return decoded;
}

function onlyDigits(value: string | undefined): string {
  return value?.replace(/\D/g, "") ?? "";
}
