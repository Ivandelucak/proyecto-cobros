import {
  buildArcaInvoiceRequest,
  validateArcaPreEmission,
  type ArcaInvoiceRequestPreview,
  type ArcaPreEmissionInput
} from "@/lib/fiscal/arca/arca-pre-emission";
import {
  sanitizeArcaDetail,
  toArcaError
} from "@/lib/fiscal/arca/arca-errors";
import { getLastAuthorizedVoucher } from "@/lib/fiscal/arca/arca-wsfe";

export type ArcaPreflightStatusTone = "OK" | "WARNING" | "ERROR" | "UNKNOWN";

export type ArcaPreflightResult = {
  canProceedToEmissionFuture: boolean;
  errors: string[];
  warnings: string[];
  pointOfSale: number | null;
  voucherType: number | null;
  voucherLabel: string;
  lastAuthorizedNumber: number | null;
  nextEstimatedNumber: number | null;
  queriedAt: string | null;
  arcaStatus: {
    token: {
      status: ArcaPreflightStatusTone;
      label: string;
      expiresAt: string | null;
    };
    wsfe: {
      status: ArcaPreflightStatusTone;
      label: string;
      details: string | null;
    };
  };
  preflight: {
    lastAuthorizedNumber: number | null;
    nextEstimatedNumber: number | null;
    cbteDesdePreview: number | null;
    cbteHastaPreview: number | null;
    note: "Numero estimado, no reservado ni emitido.";
  };
};

export async function runArcaPreflightValidation(
  input: ArcaPreEmissionInput
): Promise<ArcaPreflightResult> {
  const validation = validateArcaPreEmission(input);
  const errors = [...validation.errors];
  let warnings = [
    ...validation.warnings,
    "Emision real todavia no implementada.",
    "El proximo numero es estimado, no reservado."
  ];
  const request =
    input.sale && input.fiscalDocument ? buildArcaInvoiceRequest(input) : null;
  const pointOfSale = request?.header.ptoVta ?? null;
  const voucherType = request?.header.cbteTipo ?? null;
  const voucherLabel = request?.header.cbteTipoLabel ?? "-";
  let lastAuthorizedNumber: number | null = null;
  let nextEstimatedNumber: number | null = null;
  let queriedAt: string | null = null;
  let tokenStatus = buildTokenStatus(input);
  let wsfeStatus: ArcaPreflightResult["arcaStatus"]["wsfe"] = {
    status: input.setting.arcaLastWsfeStatus === "OK" ? "OK" : "UNKNOWN",
    label: input.setting.arcaLastWsfeStatus ?? "Sin consulta ejecutada",
    details: null
  };

  if (!request) {
    errors.push("No se pudo armar preview ARCA para ejecutar preflight.");
  }

  if (!pointOfSale) {
    errors.push("No se puede consultar WSFEv1 sin punto de venta.");
  }

  if (!voucherType) {
    errors.push("No se puede consultar WSFEv1 sin tipo de comprobante ARCA.");
  }

  if (pointOfSale && voucherType && errors.length === 0) {
    try {
      const lastVoucher = await getLastAuthorizedVoucher({
        pointOfSale,
        voucherType
      });

      lastAuthorizedNumber = lastVoucher.voucherNumber;
      nextEstimatedNumber = lastVoucher.voucherNumber + 1;
      queriedAt = new Date().toISOString();
      tokenStatus = {
        status: "OK",
        label: lastVoucher.tokenFromCache
          ? "Token WSAA valido reutilizado."
          : "Token WSAA valido obtenido para la consulta.",
        expiresAt: lastVoucher.tokenExpiresAt.toISOString()
      };
      warnings = warnings.filter((warning) => !warning.includes("Token WSAA"));
      wsfeStatus = {
        status: "OK",
        label: "WSFEv1 respondio correctamente.",
        details: null
      };
    } catch (error) {
      const arcaError = toArcaError(
        error,
        "No se pudo consultar ultimo comprobante autorizado."
      );
      const details = sanitizeArcaDetail(arcaError.details);

      errors.push(arcaError.message);
      wsfeStatus = {
        status: "ERROR",
        label: "WSFEv1 no respondio correctamente.",
        details
      };
    }
  }

  const canProceedToEmissionFuture = errors.length === 0;

  return {
    canProceedToEmissionFuture,
    errors,
    warnings,
    pointOfSale,
    voucherType,
    voucherLabel,
    lastAuthorizedNumber,
    nextEstimatedNumber,
    queriedAt,
    arcaStatus: {
      token: tokenStatus,
      wsfe: wsfeStatus
    },
    preflight: {
      lastAuthorizedNumber,
      nextEstimatedNumber,
      cbteDesdePreview: nextEstimatedNumber,
      cbteHastaPreview: nextEstimatedNumber,
      note: "Numero estimado, no reservado ni emitido."
    }
  };
}

export function buildInitialArcaPreflightStatus(input: {
  request: ArcaInvoiceRequestPreview;
  validationErrors: string[];
  validationWarnings: string[];
  setting: ArcaPreEmissionInput["setting"];
}): ArcaPreflightResult {
  const warnings = [
    ...input.validationWarnings,
    "Ejecuta el preflight para consultar ultimo comprobante autorizado.",
    "El proximo numero sera estimado, no reservado."
  ];

  return {
    canProceedToEmissionFuture: input.validationErrors.length === 0,
    errors: input.validationErrors,
    warnings,
    pointOfSale: input.request.header.ptoVta,
    voucherType: input.request.header.cbteTipo,
    voucherLabel: input.request.header.cbteTipoLabel,
    lastAuthorizedNumber: null,
    nextEstimatedNumber: null,
    queriedAt: null,
    arcaStatus: {
      token: buildTokenStatus({ setting: input.setting }),
      wsfe: {
        status: input.setting.arcaLastWsfeStatus === "OK" ? "OK" : "UNKNOWN",
        label: input.setting.arcaLastWsfeStatus ?? "Sin consulta ejecutada",
        details: null
      }
    },
    preflight: {
      lastAuthorizedNumber: null,
      nextEstimatedNumber: null,
      cbteDesdePreview: null,
      cbteHastaPreview: null,
      note: "Numero estimado, no reservado ni emitido."
    }
  };
}

function buildTokenStatus(input: Pick<ArcaPreEmissionInput, "setting">) {
  const expiresAt = input.setting.arcaTokenExpiresAt?.toISOString() ?? null;

  if (!input.setting.hasArcaWsaaToken || !input.setting.hasArcaWsaaSign) {
    return {
      status: "UNKNOWN" as const,
      label: "Token WSAA no disponible.",
      expiresAt
    };
  }

  if (!input.setting.arcaTokenIsValid) {
    return {
      status: "ERROR" as const,
      label: "Token WSAA vencido o invalido.",
      expiresAt
    };
  }

  return {
    status: "OK" as const,
    label: "Token WSAA valido.",
    expiresAt
  };
}
