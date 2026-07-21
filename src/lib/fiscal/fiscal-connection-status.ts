export type FiscalConnectionSnapshot = {
  enabled: boolean;
  environment: "HOMOLOGACION" | "PRODUCCION";
  cuit: string | null;
  fiscalCondition: string | null;
  pointOfSale: number | null;
  hasArcaCertificatePem: boolean;
  hasArcaPrivateKeyPem: boolean;
  arcaCertificateIsExpired: boolean;
  arcaTokenIsValid: boolean;
  arcaLastConnectionStatus: string | null;
  arcaLastWsfeStatus: string | null;
};

export type FiscalConnectionStatus = {
  label:
    | "Facturacion no configurada"
    | "Configuracion pendiente"
    | "Facturacion activa"
    | "Error de conexion"
    | "Certificado vencido";
  tone: "neutral" | "warning" | "success" | "danger";
  missing: string[];
};

export function getFiscalConnectionStatus(
  setting: FiscalConnectionSnapshot,
): FiscalConnectionStatus {
  const missing: string[] = [];
  const hasConnectionError =
    setting.arcaLastConnectionStatus === "ERROR" ||
    setting.arcaLastWsfeStatus === "ERROR";

  if (!isValidCuit(setting.cuit)) {
    missing.push("CUIT emisor");
  }
  if (!setting.fiscalCondition) {
    missing.push("Condicion fiscal del comercio");
  }
  if (!setting.pointOfSale) {
    missing.push("Punto de venta");
  }
  if (!setting.hasArcaCertificatePem) {
    missing.push("Certificado de conexion");
  }
  if (!setting.hasArcaPrivateKeyPem) {
    missing.push("Clave privada de conexion");
  }
  if (!setting.arcaTokenIsValid || setting.arcaLastWsfeStatus !== "OK") {
    missing.push("Verificacion de la conexion con ARCA");
  }
  if (!setting.enabled) {
    missing.push("Habilitar facturacion electronica");
  }
  if (setting.environment !== "PRODUCCION") {
    missing.push("Activacion para emitir comprobantes reales");
  }

  if (setting.arcaCertificateIsExpired) {
    return { label: "Certificado vencido", tone: "danger", missing };
  }

  if (hasConnectionError) {
    return { label: "Error de conexion", tone: "danger", missing };
  }

  if (missing.length === 0) {
    return { label: "Facturacion activa", tone: "success", missing };
  }

  const hasFiscalData = Boolean(
    setting.cuit ||
      setting.fiscalCondition ||
      setting.pointOfSale ||
      setting.hasArcaCertificatePem ||
      setting.hasArcaPrivateKeyPem,
  );

  return {
    label: hasFiscalData ? "Configuracion pendiente" : "Facturacion no configurada",
    tone: hasFiscalData ? "warning" : "neutral",
    missing,
  };
}

function isValidCuit(value: string | null) {
  return (value ?? "").replace(/\D/g, "").length === 11;
}
