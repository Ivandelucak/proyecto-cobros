import { FiscalEnvironment } from "@prisma/client";
import {
  ARCA_ENDPOINTS,
  WSFEV1_NAMESPACE
} from "@/lib/fiscal/arca/arca-config";
import { ArcaError } from "@/lib/fiscal/arca/arca-errors";
import { sendSoapRequest } from "@/lib/fiscal/arca/arca-soap";
import {
  escapeXml,
  extractItems,
  extractTag
} from "@/lib/fiscal/arca/arca-xml";
import { getArcaAuthToken, type ArcaAuthToken } from "@/lib/fiscal/arca/arca-wsaa";

type WsfeCatalogItem = {
  id: string;
  description: string;
  from: string | null;
  to: string | null;
};

export async function getWsfeServerStatus() {
  const auth = await getArcaAuthToken();
  const xml = await callWsfe({
    environment: auth.environment,
    operation: "FEDummy",
    body: "<ar:FEDummy/>"
  });

  return {
    appServer: extractTag(xml, "AppServer") ?? "-",
    dbServer: extractTag(xml, "DbServer") ?? "-",
    authServer: extractTag(xml, "AuthServer") ?? "-"
  };
}

export async function getLastAuthorizedVoucher(input: {
  pointOfSale: number;
  voucherType: number;
}) {
  const auth = await getArcaAuthToken();
  const xml = await callWsfe({
    environment: auth.environment,
    operation: "FECompUltimoAutorizado",
    body: [
      "<ar:FECompUltimoAutorizado>",
      buildAuthXml(auth),
      `<ar:PtoVta>${input.pointOfSale}</ar:PtoVta>`,
      `<ar:CbteTipo>${input.voucherType}</ar:CbteTipo>`,
      "</ar:FECompUltimoAutorizado>"
    ].join("")
  });

  const voucherNumber = Number(extractTag(xml, "CbteNro") ?? 0);

  return {
    pointOfSale: input.pointOfSale,
    voucherType: input.voucherType,
    voucherNumber: Number.isFinite(voucherNumber) ? voucherNumber : 0
  };
}

export async function getDocumentTypes() {
  return getCatalog("FEParamGetTiposDoc", "DocTipo");
}

export async function getVoucherTypes() {
  return getCatalog("FEParamGetTiposCbte", "CbteTipo");
}

export async function getVatTypes() {
  return getCatalog("FEParamGetTiposIva", "IvaTipo");
}

async function getCatalog(operation: string, itemTag: string): Promise<WsfeCatalogItem[]> {
  const auth = await getArcaAuthToken();
  const xml = await callWsfe({
    environment: auth.environment,
    operation,
    body: [
      `<ar:${operation}>`,
      buildAuthXml(auth),
      `</ar:${operation}>`
    ].join("")
  });

  return extractItems(xml, itemTag).map((itemXml) => ({
    id: extractTag(itemXml, "Id") ?? "-",
    description: extractTag(itemXml, "Desc") ?? "-",
    from: extractTag(itemXml, "FchDesde"),
    to: extractTag(itemXml, "FchHasta")
  }));
}

async function callWsfe(input: {
  environment: FiscalEnvironment;
  operation: string;
  body: string;
}) {
  if (input.environment !== FiscalEnvironment.HOMOLOGACION) {
    throw new ArcaError("Esta etapa solo permite WSFEv1 homologacion.");
  }

  return sendSoapRequest({
    endpoint: ARCA_ENDPOINTS[input.environment].wsfev1,
    soapAction: `${WSFEV1_NAMESPACE}${input.operation}`,
    body: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">',
      "<soapenv:Header/>",
      "<soapenv:Body>",
      input.body,
      "</soapenv:Body>",
      "</soapenv:Envelope>"
    ].join("")
  });
}

function buildAuthXml(auth: ArcaAuthToken) {
  return [
    "<ar:Auth>",
    `<ar:Token>${escapeXml(auth.token)}</ar:Token>`,
    `<ar:Sign>${escapeXml(auth.sign)}</ar:Sign>`,
    `<ar:Cuit>${escapeXml(auth.cuit)}</ar:Cuit>`,
    "</ar:Auth>"
  ].join("");
}
