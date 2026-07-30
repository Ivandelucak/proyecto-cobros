import forge from "node-forge";
import { FiscalConnectionMode, FiscalEnvironment } from "@prisma/client";
import {
  ARCA_ENDPOINTS,
  ARCA_WSAA_SERVICE
} from "@/lib/fiscal/arca/arca-config";
import {
  ArcaError,
  sanitizeArcaDetail
} from "@/lib/fiscal/arca/arca-errors";
import { sendSoapRequest } from "@/lib/fiscal/arca/arca-soap";
import {
  escapeXml,
  extractTag,
  formatArcaDate
} from "@/lib/fiscal/arca/arca-xml";
import {
  getCachedProviderAuth,
  saveCachedProviderAuth,
  type CachedProviderAuth
} from "@/lib/fiscal/provider-auth-cache.server";
import { assertProviderTokenEncryptionReady } from "@/lib/fiscal/provider-token-crypto.server";
import {
  resolveFiscalCredentials,
  type LegacyFiscalCredentials,
  type ProviderDelegationCredentials
} from "@/lib/fiscal/fiscal-credentials.server";
import { prisma } from "@/lib/prisma";

const TOKEN_REFRESH_SAFETY_MS = 10 * 60 * 1000;
const PROVIDER_CACHE_RETRY_MS = 150;
const PROVIDER_CACHE_RETRY_ATTEMPTS = 4;
const providerAuthRefreshes = new Map<string, Promise<CachedProviderAuth>>();

export type ArcaAuthToken = {
  token: string;
  sign: string;
  expirationTime: Date;
  cuit: string;
  environment: FiscalEnvironment;
  connectionMode: FiscalConnectionMode;
  fromCache: boolean;
  alreadyAuthenticated: boolean;
};

export async function getArcaAuthToken(
  businessId: string,
  options: { forceRefresh?: boolean } = {}
) {
  const credentials = await resolveFiscalCredentials({ businessId });

  if (credentials.connectionMode === FiscalConnectionMode.PROVIDER_DELEGATION) {
    return getProviderDelegationAuthToken(credentials, options);
  }

  return getLegacyArcaAuthToken(credentials, options);
}

async function getLegacyArcaAuthToken(
  credentials: LegacyFiscalCredentials,
  options: { forceRefresh?: boolean }
): Promise<ArcaAuthToken> {
  if (credentials.environment !== FiscalEnvironment.HOMOLOGACION) {
    throw new ArcaError("Esta etapa solo permite ARCA homologacion.");
  }

  if (!options.forceRefresh && isLegacyCachedTokenUsable(credentials)) {
    return buildLegacyCachedAuthToken(credentials, false);
  }

  const response = await requestLoginCms({
    environment: credentials.environment,
    certificatePem: credentials.certificatePem,
    privateKeyPem: credentials.privateKeyPem,
    service: ARCA_WSAA_SERVICE
  });

  if (response.alreadyAuthenticated) {
    if (isLegacyCachedTokenFuture(credentials)) {
      return buildLegacyCachedAuthToken(credentials, true);
    }

    throw new ArcaError(
      "ARCA informa que ya existe un Ticket de Acceso valido para este servicio."
    );
  }

  await prisma.fiscalSetting.update({
    where: { id: credentials.fiscalSettingId },
    data: {
      arcaWsaaToken: response.token,
      arcaWsaaSign: response.sign,
      arcaTokenExpiresAt: response.expirationTime,
      arcaLastConnectionStatus: "OK",
      arcaLastConnectionTestAt: new Date(),
      arcaLastError: null
    }
  });

  return {
    token: response.token,
    sign: response.sign,
    expirationTime: response.expirationTime,
    cuit: credentials.representedCuit,
    environment: credentials.environment,
    connectionMode: FiscalConnectionMode.LEGACY_PER_BUSINESS,
    fromCache: false,
    alreadyAuthenticated: false
  };
}

async function getProviderDelegationAuthToken(
  credentials: ProviderDelegationCredentials,
  options: { forceRefresh?: boolean }
): Promise<ArcaAuthToken> {
  assertProviderTokenEncryptionReady();

  const cacheKey = {
    certificateFingerprint: credentials.certificateFingerprint,
    environment: credentials.environment,
    service: credentials.service
  };

  if (!options.forceRefresh) {
    const cached = await getCachedProviderAuth(cacheKey);
    if (cached) {
      return buildProviderAuthToken(credentials, cached, { fromCache: true, alreadyAuthenticated: false });
    }
  }

  const cached = await refreshProviderAuth(credentials, cacheKey);

  return buildProviderAuthToken(credentials, cached, { fromCache: false, alreadyAuthenticated: false });
}

async function refreshProviderAuth(
  credentials: ProviderDelegationCredentials,
  cacheKey: {
    certificateFingerprint: string;
    environment: FiscalEnvironment;
    service: string;
  }
): Promise<CachedProviderAuth> {
  const refreshKey = [
    cacheKey.certificateFingerprint,
    cacheKey.environment,
    cacheKey.service
  ].join(":");
  const activeRefresh = providerAuthRefreshes.get(refreshKey);
  if (activeRefresh) {
    return activeRefresh;
  }

  const refresh = requestProviderAuthRefresh(credentials, cacheKey);
  providerAuthRefreshes.set(refreshKey, refresh);

  try {
    return await refresh;
  } finally {
    if (providerAuthRefreshes.get(refreshKey) === refresh) {
      providerAuthRefreshes.delete(refreshKey);
    }
  }
}

async function requestProviderAuthRefresh(
  credentials: ProviderDelegationCredentials,
  cacheKey: {
    certificateFingerprint: string;
    environment: FiscalEnvironment;
    service: string;
  }
): Promise<CachedProviderAuth> {
  const response = await requestLoginCms({
    environment: credentials.environment,
    certificatePem: credentials.certificatePem,
    privateKeyPem: credentials.privateKeyPem,
    service: credentials.service
  });

  if (response.alreadyAuthenticated) {
    const cached = await waitForProviderAuthCache(cacheKey);
    if (cached) {
      return cached;
    }

    throw new ArcaError(
      "ARCA informa que ya existe un Ticket de Acceso valido para este servicio. Intentá nuevamente cuando se renueve."
    );
  }

  const cached = {
    token: response.token,
    sign: response.sign,
    expirationTime: response.expirationTime
  };
  await saveCachedProviderAuth(cacheKey, cached);
  return cached;
}

async function waitForProviderAuthCache(cacheKey: {
  certificateFingerprint: string;
  environment: FiscalEnvironment;
  service: string;
}) {
  for (let attempt = 0; attempt < PROVIDER_CACHE_RETRY_ATTEMPTS; attempt += 1) {
    const cached = await getCachedProviderAuth(cacheKey, { allowNearExpiry: true });
    if (cached) {
      return cached;
    }
    if (attempt + 1 < PROVIDER_CACHE_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, PROVIDER_CACHE_RETRY_MS));
    }
  }

  return null;
}

async function requestLoginCms(input: {
  environment: FiscalEnvironment;
  certificatePem: string;
  privateKeyPem: string;
  service: string;
}): Promise<
  | { token: string; sign: string; expirationTime: Date; alreadyAuthenticated: false }
  | { alreadyAuthenticated: true }
> {
  const endpoint = ARCA_ENDPOINTS[input.environment].wsaa;
  const tra = createLoginTicketRequestXml(input.service);
  validateGeneratedTraXml(tra);
  const cms = signLoginTicketRequest(tra, input);
  logWsaaDebug("Solicitud LoginCms generada.", {
    endpoint,
    service: input.service,
    traXml: tra,
    cmsBase64Length: cms.length
  });

  let responseXml: string;
  try {
    responseXml = await sendSoapRequest({
      endpoint,
      soapAction: "",
      body: buildLoginCmsSoapEnvelope(cms),
      includeRawResponseInError: true
    });
  } catch (error) {
    const arcaError =
      error instanceof ArcaError
        ? error
        : new ArcaError(
            "No se pudo obtener token WSAA.",
            error instanceof Error ? error.message : undefined
          );

    logWsaaDebug("Respuesta LoginCms fallida.", {
      endpoint,
      service: input.service,
      rawSoap: sanitizeArcaDetail(arcaError.details) ?? arcaError.message
    });

    if (isWsaaAlreadyAuthenticatedError(arcaError)) {
      return { alreadyAuthenticated: true };
    }

    if (isWsaaXmlSchemaError(arcaError)) {
      throw new ArcaError(
        "El XML/CMS enviado a WSAA no cumple el schema. Revisar TRA/CMS.",
        arcaError.details
      );
    }

    throw arcaError;
  }

  const loginCmsReturn = extractTag(responseXml, "loginCmsReturn");
  if (!loginCmsReturn) {
    throw new ArcaError("No se pudo obtener token WSAA.", "Respuesta WSAA sin loginCmsReturn.");
  }

  const token = extractTag(loginCmsReturn, "token");
  const sign = extractTag(loginCmsReturn, "sign");
  const expiration = extractTag(loginCmsReturn, "expirationTime");
  if (!token || !sign || !expiration) {
    throw new ArcaError("No se pudo obtener token WSAA.", "Respuesta WSAA incompleta.");
  }

  const expirationTime = new Date(expiration);
  if (Number.isNaN(expirationTime.getTime())) {
    throw new ArcaError("No se pudo obtener token WSAA.", "Vencimiento WSAA invalido.");
  }

  return { token, sign, expirationTime, alreadyAuthenticated: false };
}

function isLegacyCachedTokenUsable(credentials: LegacyFiscalCredentials) {
  if (!credentials.token || !credentials.sign || !credentials.tokenExpiresAt) {
    return false;
  }

  return credentials.tokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_SAFETY_MS;
}

function isLegacyCachedTokenFuture(credentials: LegacyFiscalCredentials) {
  if (!credentials.token || !credentials.sign || !credentials.tokenExpiresAt) {
    return false;
  }

  return credentials.tokenExpiresAt.getTime() > Date.now();
}

function buildLegacyCachedAuthToken(
  credentials: LegacyFiscalCredentials,
  alreadyAuthenticated: boolean
): ArcaAuthToken {
  return {
    token: credentials.token!,
    sign: credentials.sign!,
    expirationTime: credentials.tokenExpiresAt!,
    cuit: credentials.representedCuit,
    environment: credentials.environment,
    connectionMode: FiscalConnectionMode.LEGACY_PER_BUSINESS,
    fromCache: true,
    alreadyAuthenticated
  };
}

function buildProviderAuthToken(
  credentials: ProviderDelegationCredentials,
  cached: { token: string; sign: string; expirationTime: Date },
  options: { fromCache: boolean; alreadyAuthenticated: boolean }
): ArcaAuthToken {
  return {
    token: cached.token,
    sign: cached.sign,
    expirationTime: cached.expirationTime,
    cuit: credentials.representedCuit,
    environment: credentials.environment,
    connectionMode: FiscalConnectionMode.PROVIDER_DELEGATION,
    fromCache: options.fromCache,
    alreadyAuthenticated: options.alreadyAuthenticated
  };
}

function createLoginTicketRequestXml(service: string) {
  const now = Date.now();
  const uniqueId = Math.floor(now / 1000);
  const generationTime = new Date(now - 5 * 60 * 1000);
  const expirationTime = new Date(now + 12 * 60 * 60 * 1000);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<loginTicketRequest version="1.0">',
    "<header>",
    `<uniqueId>${uniqueId}</uniqueId>`,
    `<generationTime>${formatArcaDate(generationTime)}</generationTime>`,
    `<expirationTime>${formatArcaDate(expirationTime)}</expirationTime>`,
    "</header>",
    `<service>${escapeXml(service)}</service>`,
    "</loginTicketRequest>"
  ].join("\n");
}

export function validateGeneratedTraXml(traXml: string) {
  if (!/<loginTicketRequest\b[^>]*\bversion="1\.0"[^>]*>/i.test(traXml)) {
    throw new ArcaError("TRA WSAA invalido.", "Falta loginTicketRequest con version=\"1.0\".");
  }
  if (!extractTag(traXml, "header")) {
    throw new ArcaError("TRA WSAA invalido.", "Falta header.");
  }
  if (!extractTag(traXml, "uniqueId")) {
    throw new ArcaError("TRA WSAA invalido.", "Falta uniqueId.");
  }

  const generationTime = extractTag(traXml, "generationTime");
  if (!generationTime || Number.isNaN(new Date(generationTime).getTime())) {
    throw new ArcaError("TRA WSAA invalido.", "Falta generationTime valido.");
  }

  const expirationTime = extractTag(traXml, "expirationTime");
  if (!expirationTime || Number.isNaN(new Date(expirationTime).getTime())) {
    throw new ArcaError("TRA WSAA invalido.", "Falta expirationTime valido.");
  }

  const maxExpirationMs = new Date(generationTime).getTime() + 24 * 60 * 60 * 1000;
  if (new Date(expirationTime).getTime() > maxExpirationMs) {
    throw new ArcaError("TRA WSAA invalido.", "expirationTime supera 24 horas.");
  }

  if (extractTag(traXml, "service") !== ARCA_WSAA_SERVICE) {
    throw new ArcaError("TRA WSAA invalido.", "service debe ser wsfe.");
  }
}

function signLoginTicketRequest(
  traXml: string,
  credentials: { certificatePem: string; privateKeyPem: string }
) {
  try {
    const certificate = forge.pki.certificateFromPem(credentials.certificatePem);
    const privateKey = forge.pki.privateKeyFromPem(credentials.privateKeyPem);
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(traXml, "utf8");
    p7.addCertificate(certificate);
    p7.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime }
      ]
    });
    p7.sign({ detached: false });

    return forge.util
      .encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
      .replace(/\s+/g, "");
  } catch (error) {
    throw new ArcaError(
      "No se pudo firmar la solicitud WSAA.",
      error instanceof Error ? error.message : undefined
    );
  }
}

function buildLoginCmsSoapEnvelope(cms: string) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">',
    "<soapenv:Header/>",
    "<soapenv:Body>",
    "<wsaa:loginCms>",
    `<in0>${escapeXml(cms)}</in0>`,
    "</wsaa:loginCms>",
    "</soapenv:Body>",
    "</soapenv:Envelope>"
  ].join("\n");
}

function isWsaaXmlSchemaError(error: ArcaError) {
  return `${error.message}\n${error.details ?? ""}`.toLowerCase().includes("xml.bad");
}

function isWsaaAlreadyAuthenticatedError(error: ArcaError) {
  return `${error.message}\n${error.details ?? ""}`
    .toLowerCase()
    .includes("coe.alreadyauthenticated");
}

function logWsaaDebug(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info("[ARCA WSAA]", message, payload);
  }
}
