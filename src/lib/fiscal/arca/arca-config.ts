import { FiscalEnvironment } from "@prisma/client";

export const ARCA_WSAA_SERVICE = "wsfe";

export const ARCA_ENDPOINTS = {
  HOMOLOGACION: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfev1: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
  },
  PRODUCCION: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfev1: "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
  }
} satisfies Record<FiscalEnvironment, { wsaa: string; wsfev1: string }>;

export const WSFEV1_NAMESPACE = "http://ar.gov.afip.dif.FEV1/";

export const VOUCHER_TYPE_OPTIONS = [
  { code: 1, label: "Factura A" },
  { code: 6, label: "Factura B" },
  { code: 11, label: "Factura C" },
  { code: 3, label: "Nota de credito A" },
  { code: 8, label: "Nota de credito B" },
  { code: 13, label: "Nota de credito C" }
];
