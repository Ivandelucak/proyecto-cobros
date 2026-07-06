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
  extractSoapFault,
  extractTag
} from "@/lib/fiscal/arca/arca-xml";
import { getArcaAuthToken, type ArcaAuthToken } from "@/lib/fiscal/arca/arca-wsaa";

type WsfeCatalogItem = {
  id: string;
  description: string;
  from: string | null;
  to: string | null;
};

export async function getWsfeServerStatus(businessId: string) {
  const auth = await getArcaAuthToken(businessId);
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

export async function getLastAuthorizedVoucher(
  businessId: string,
  input: {
    pointOfSale: number;
    voucherType: number;
  }
) {
  const auth = await getArcaAuthToken(businessId);
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
    voucherNumber: Number.isFinite(voucherNumber) ? voucherNumber : 0,
    tokenExpiresAt: auth.expirationTime,
    tokenFromCache: auth.fromCache
  };
}

export async function getDocumentTypes(businessId: string) {
  return getCatalog(businessId, "FEParamGetTiposDoc", "DocTipo");
}

export async function getVoucherTypes(businessId: string) {
  return getCatalog(businessId, "FEParamGetTiposCbte", "CbteTipo");
}

export async function getVatTypes(businessId: string) {
  return getCatalog(businessId, "FEParamGetTiposIva", "IvaTipo");
}

async function getCatalog(businessId: string, operation: string, itemTag: string): Promise<WsfeCatalogItem[]> {
  const auth = await getArcaAuthToken(businessId);
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

export async function requestCae(
  businessId: string,
  input: {
    pointOfSale: number;
    voucherType: number;
    nextNumber: number;
    concepto: number;
    docType: number;
    docNro: string;
    cbteFch: string;
    impTotal: string;
    impTotConc: string;
    impNeto: string;
    impOpEx: string;
    impIVA: string;
    impTrib: string;
    iva: Array<{ id: number | null; baseImp: string; importe: string }>;
    condicionIVAReceptorId: number;
  }
) {
  const auth = await getArcaAuthToken(businessId);

  const ivaXml = input.iva.length > 0
    ? `<ar:Iva>${input.iva
        .map(
          (item) => `
          <ar:AlicIva>
            <ar:Id>${item.id}</ar:Id>
            <ar:BaseImp>${item.baseImp}</ar:BaseImp>
            <ar:Importe>${item.importe}</ar:Importe>
          </ar:AlicIva>
        `
        )
        .join("")}</ar:Iva>`
    : "";

  const bodyXml = [
    "<ar:FECAESolicitar>",
    buildAuthXml(auth),
    "<ar:FeCAEReq>",
    "<ar:FeCabReq>",
    "<ar:CantReg>1</ar:CantReg>",
    `<ar:PtoVta>${input.pointOfSale}</ar:PtoVta>`,
    `<ar:CbteTipo>${input.voucherType}</ar:CbteTipo>`,
    "</ar:FeCabReq>",
    "<ar:FeDetReq>",
    "<ar:FECAEDetRequest>",
    `<ar:Concepto>${input.concepto}</ar:Concepto>`,
    `<ar:DocTipo>${input.docType}</ar:DocTipo>`,
    `<ar:DocNro>${input.docNro}</ar:DocNro>`,
    `<ar:CbteDesde>${input.nextNumber}</ar:CbteDesde>`,
    `<ar:CbteHasta>${input.nextNumber}</ar:CbteHasta>`,
    `<ar:CbteFch>${input.cbteFch}</ar:CbteFch>`,
    `<ar:ImpTotal>${input.impTotal}</ar:ImpTotal>`,
    `<ar:ImpTotConc>${input.impTotConc}</ar:ImpTotConc>`,
    `<ar:ImpNeto>${input.impNeto}</ar:ImpNeto>`,
    `<ar:ImpOpEx>${input.impOpEx}</ar:ImpOpEx>`,
    `<ar:ImpTrib>${input.impTrib}</ar:ImpTrib>`,
    `<ar:ImpIVA>${input.impIVA}</ar:ImpIVA>`,
    `<ar:CondicionIVAReceptorId>${input.condicionIVAReceptorId}</ar:CondicionIVAReceptorId>`,
    "<ar:MonId>PES</ar:MonId>",
    "<ar:MonCotiz>1</ar:MonCotiz>",
    ivaXml,
    "</ar:FECAEDetRequest>",
    "</ar:FeDetReq>",
    "</ar:FeCAEReq>",
    "</ar:FECAESolicitar>"
  ].join("");

  const responseXml = await callWsfe({
    environment: auth.environment,
    operation: "FECAESolicitar",
    body: bodyXml
  });

  return parseCaeResponse(responseXml);
}

function parseCaeResponse(xml: string) {
  const soapFault = extractSoapFault(xml);
  if (soapFault) {
    throw new ArcaError("Error de SOAP en solicitud CAE.", soapFault);
  }

  const errorsBlock = extractTag(xml, "Errors");
  if (errorsBlock) {
    const errorItems = extractItems(errorsBlock, "Err");
    if (errorItems.length > 0) {
      const msgs = errorItems.map((item) => {
        const code = extractTag(item, "Code");
        const msg = extractTag(item, "Msg");
        return `[${code}] ${msg}`;
      });
      throw new ArcaError("ARCA devolvió errores en la solicitud.", msgs.join(" | "));
    }
  }

  const cabResp = extractTag(xml, "FeCabResp");
  const detResp = extractTag(xml, "FeDetResp");
  const detResponse = detResp ? extractTag(detResp, "FECAEDetResponse") : null;

  if (!cabResp || !detResponse) {
    throw new ArcaError("Respuesta de ARCA incompleta o sin cuerpo de resultado.");
  }

  const cabResult = extractTag(cabResp, "Resultado");
  const detResult = extractTag(detResponse, "Resultado");
  const cae = extractTag(detResponse, "CAE");
  const caeDueDateStr = extractTag(detResponse, "CAEFchVto");

  const obsBlock = extractTag(detResponse, "Observaciones");
  let observations: string[] = [];
  if (obsBlock) {
    const obsItems = extractItems(obsBlock, "Obs");
    observations = obsItems.map((item) => {
      const code = extractTag(item, "Code");
      const msg = extractTag(item, "Msg");
      return `[${code}] ${msg}`;
    });
  }

  return {
    result: detResult || cabResult || "R",
    cae: cae || null,
    caeDueDate: caeDueDateStr ? parseArcaDueDate(caeDueDateStr) : null,
    observations,
    rawResponse: xml
  };
}

function parseArcaDueDate(dueDateStr: string): Date | null {
  if (dueDateStr.length === 8) {
    const year = Number(dueDateStr.substring(0, 4));
    const month = Number(dueDateStr.substring(4, 6)) - 1;
    const day = Number(dueDateStr.substring(6, 8));
    return new Date(year, month, day);
  }
  return null;
}

export async function consultFiscalDocumentInArca(
  businessId: string,
  input: {
    pointOfSale: number;
    voucherType: number;
    voucherNumber: number;
  }
) {
  const auth = await getArcaAuthToken(businessId);
  const xml = await callWsfe({
    environment: auth.environment,
    operation: "FECompConsultar",
    body: [
      "<ar:FECompConsultar>",
      buildAuthXml(auth),
      "<ar:FeCompConsReq>",
      `<ar:CbteTipo>${input.voucherType}</ar:CbteTipo>`,
      `<ar:CbteNro>${input.voucherNumber}</ar:CbteNro>`,
      `<ar:PtoVta>${input.pointOfSale}</ar:PtoVta>`,
      "</ar:FeCompConsReq>",
      "</ar:FECompConsultar>"
    ].join("")
  });

  return parseConsultResponse(xml);
}

function parseConsultResponse(xml: string) {
  const soapFault = extractSoapFault(xml);
  if (soapFault) {
    throw new ArcaError("Error de SOAP en consulta de comprobante.", soapFault);
  }

  const errorsBlock = extractTag(xml, "Errors");
  if (errorsBlock) {
    const errorItems = extractItems(errorsBlock, "Err");
    if (errorItems.length > 0) {
      const msgs = errorItems.map((item) => {
        const code = extractTag(item, "Code");
        const msg = extractTag(item, "Msg");
        return `[${code}] ${msg}`;
      });
      throw new ArcaError("ARCA devolvió errores en la consulta.", msgs.join(" | "));
    }
  }

  const resultGet = extractTag(xml, "ResultGet");
  if (!resultGet) {
    throw new ArcaError("Respuesta de ARCA incompleta o sin cuerpo de resultado de consulta.");
  }

  const cae = extractTag(resultGet, "CodAutorizacion");
  const caeDueDateStr = extractTag(resultGet, "FchVto");
  const cbteFchStr = extractTag(resultGet, "CbteFch");
  const impTotal = extractTag(resultGet, "ImpTotal");
  const docNro = extractTag(resultGet, "DocNro");
  const docTipo = extractTag(resultGet, "DocTipo");
  const ptovta = extractTag(resultGet, "PtoVta");
  const cbteTipo = extractTag(resultGet, "CbteTipo");
  const cbteNro = extractTag(resultGet, "CbteDesde") || extractTag(resultGet, "CbteHasta");

  const obsBlock = extractTag(resultGet, "Observaciones");
  let observations: string[] = [];
  if (obsBlock) {
    const obsItems = extractItems(obsBlock, "Obs");
    observations = obsItems.map((item) => {
      const code = extractTag(item, "Code");
      const msg = extractTag(item, "Msg");
      return `[${code}] ${msg}`;
    });
  }

  return {
    cae: cae || null,
    caeDueDate: caeDueDateStr ? parseArcaDueDate(caeDueDateStr) : null,
    cbteFch: cbteFchStr || null,
    impTotal: impTotal || null,
    docNro: docNro || null,
    docTipo: docTipo ? Number(docTipo) : null,
    pointOfSale: ptovta ? Number(ptovta) : null,
    voucherType: cbteTipo ? Number(cbteTipo) : null,
    voucherNumber: cbteNro ? Number(cbteNro) : null,
    observations,
    rawResponse: xml
  };
}
