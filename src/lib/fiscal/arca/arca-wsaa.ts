import forge from "node-forge";
import { FiscalEnvironment } from "@prisma/client";
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
import { FISCAL_SETTING_ID } from "@/lib/fiscal/fiscal-settings";
import { prisma } from "@/lib/prisma";

type ArcaSettingWithSecrets = {
  id: string;
  environment: FiscalEnvironment;
  cuit: string | null;
  arcaCertificatePem: string | null;
  arcaPrivateKeyPem: string | null;
  arcaWsaaToken: string | null;
  arcaWsaaSign: string | null;
  arcaTokenExpiresAt: Date | null;
};

export type ArcaAuthToken = {
  token: string;
  sign: string;
  expirationTime: Date;
  cuit: string;
  environment: FiscalEnvironment;
  fromCache: boolean;
};

export async function getArcaAuthToken(options: { forceRefresh?: boolean } = {}) {
  const setting = await getArcaSettingWithSecrets();
  validateArcaWsaaSetting(setting);

  if (!options.forceRefresh && isCachedTokenValid(setting)) {
    return {
      token: setting.arcaWsaaToken!,
      sign: setting.arcaWsaaSign!,
      expirationTime: setting.arcaTokenExpiresAt!,
      cuit: onlyDigits(setting.cuit),
      environment: setting.environment,
      fromCache: true
    } satisfies ArcaAuthToken;
  }

  const endpoint = ARCA_ENDPOINTS[setting.environment].wsaa;
  const tra = createLoginTicketRequestXml(ARCA_WSAA_SERVICE);
  validateGeneratedTraXml(tra);
  const cms = signLoginTicketRequest(tra, setting);
  logWsaaDebug("Solicitud LoginCms generada.", {
    endpoint,
    service: ARCA_WSAA_SERVICE,
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
      service: ARCA_WSAA_SERVICE,
      rawSoap: sanitizeArcaDetail(arcaError.details) ?? arcaError.message
    });

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
    throw new ArcaError(
      "No se pudo obtener token WSAA.",
      "Respuesta WSAA incompleta."
    );
  }

  const expirationTime = new Date(expiration);
  if (Number.isNaN(expirationTime.getTime())) {
    throw new ArcaError("No se pudo obtener token WSAA.", "Vencimiento WSAA invalido.");
  }

  await prisma.fiscalSetting.update({
    where: { id: setting.id },
    data: {
      arcaWsaaToken: token,
      arcaWsaaSign: sign,
      arcaTokenExpiresAt: expirationTime,
      arcaLastConnectionStatus: "OK",
      arcaLastConnectionTestAt: new Date(),
      arcaLastError: null
    }
  });

  return {
    token,
    sign,
    expirationTime,
    cuit: onlyDigits(setting.cuit),
    environment: setting.environment,
    fromCache: false
  } satisfies ArcaAuthToken;
}

async function getArcaSettingWithSecrets() {
  const setting = await prisma.fiscalSetting.findUnique({
    where: { id: FISCAL_SETTING_ID },
    select: {
      id: true,
      environment: true,
      cuit: true,
      arcaCertificatePem: true,
      arcaPrivateKeyPem: true,
      arcaWsaaToken: true,
      arcaWsaaSign: true,
      arcaTokenExpiresAt: true
    }
  });

  if (!setting) {
    throw new ArcaError("Falta configuracion fiscal.");
  }

  return setting;
}

function validateArcaWsaaSetting(setting: ArcaSettingWithSecrets) {
  if (setting.environment !== FiscalEnvironment.HOMOLOGACION) {
    throw new ArcaError("Esta etapa solo permite ARCA homologacion.");
  }

  if (!onlyDigits(setting.cuit)) {
    throw new ArcaError("Falta CUIT emisor.");
  }

  if (!setting.arcaCertificatePem?.trim()) {
    throw new ArcaError("Falta certificado.");
  }

  if (!setting.arcaPrivateKeyPem?.trim()) {
    throw new ArcaError("Falta clave privada.");
  }
}

function isCachedTokenValid(setting: ArcaSettingWithSecrets) {
  if (!setting.arcaWsaaToken || !setting.arcaWsaaSign || !setting.arcaTokenExpiresAt) {
    return false;
  }

  return setting.arcaTokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000;
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
    throw new ArcaError(
      "TRA WSAA invalido.",
      "Falta loginTicketRequest con version=\"1.0\"."
    );
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

  const service = extractTag(traXml, "service");
  if (service !== ARCA_WSAA_SERVICE) {
    throw new ArcaError("TRA WSAA invalido.", "service debe ser wsfe.");
  }
}

function signLoginTicketRequest(traXml: string, setting: ArcaSettingWithSecrets) {
  try {
    const certificate = forge.pki.certificateFromPem(setting.arcaCertificatePem ?? "");
    const privateKey = forge.pki.privateKeyFromPem(setting.arcaPrivateKeyPem ?? "");
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(traXml, "utf8");
    p7.addCertificate(certificate);
    p7.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
        },
        {
          type: forge.pki.oids.signingTime
        }
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

function onlyDigits(value: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function isWsaaXmlSchemaError(error: ArcaError) {
  const text = `${error.message}\n${error.details ?? ""}`.toLowerCase();

  return text.includes("xml.bad") || text.includes("schema");
}

function logWsaaDebug(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[ARCA WSAA]", message, payload);
}
