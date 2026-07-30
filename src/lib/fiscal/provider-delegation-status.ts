export type ProviderDelegationSnapshot = {
  connectionMode: "LEGACY_PER_BUSINESS" | "PROVIDER_DELEGATION";
  enabled: boolean;
  cuit: string | null;
  legalName: string | null;
  fiscalCondition: string | null;
  pointOfSale: number | null;
  delegationDeclaredAt: Date | null;
  providerVerificationStatus: "PENDING" | "VERIFIED" | "FAILED";
  providerVerifiedAt: Date | null;
};

export type ProviderDelegationVisualStatus = {
  label: string;
  description: string;
  tone: "neutral" | "warning" | "success" | "danger";
  canDeclare: boolean;
  canVerify: boolean;
};

export function getProviderDelegationVisualStatus(
  setting: ProviderDelegationSnapshot,
  providerConfigured: boolean
): ProviderDelegationVisualStatus {
  if (setting.connectionMode !== "PROVIDER_DELEGATION") {
    return {
      label: "Conexión heredada",
      description: "Este comercio conserva su configuración fiscal anterior.",
      tone: "neutral",
      canDeclare: false,
      canVerify: false
    };
  }

  if (!hasFiscalData(setting)) {
    return {
      label: "Datos fiscales pendientes",
      description: "Completá el CUIT, la razón social, la condición fiscal y el punto de venta.",
      tone: "warning",
      canDeclare: false,
      canVerify: false
    };
  }

  if (!providerConfigured) {
    return {
      label: "Servicio no disponible",
      description: "La conexión administrada por Fox Point todavía no está disponible.",
      tone: "warning",
      canDeclare: false,
      canVerify: false
    };
  }

  if (!setting.delegationDeclaredAt) {
    return {
      label: "Delegación pendiente",
      description: "Autorizá a Fox Point desde ARCA y confirmá el paso cuando termines.",
      tone: "warning",
      canDeclare: true,
      canVerify: false
    };
  }

  if (setting.providerVerificationStatus === "VERIFIED") {
    return {
      label: "Conexión verificada",
      description: "La delegación respondió correctamente. La emisión delegada todavía no está habilitada.",
      tone: "success",
      canDeclare: false,
      canVerify: true
    };
  }

  if (setting.providerVerificationStatus === "FAILED") {
    return {
      label: "Se necesita revisar la conexión",
      description: "Revisá la delegación y el punto de venta antes de verificar nuevamente.",
      tone: "danger",
      canDeclare: false,
      canVerify: true
    };
  }

  return {
    label: "Verificación pendiente",
    description: "Estamos confirmando la autorización recibida. Podés verificar la conexión cuando esté lista.",
    tone: "warning",
    canDeclare: false,
    canVerify: true
  };
}

function hasFiscalData(setting: ProviderDelegationSnapshot) {
  return Boolean(
    /^\d{11}$/.test((setting.cuit ?? "").replace(/\D/g, "")) &&
      setting.legalName?.trim() &&
      setting.fiscalCondition &&
      setting.pointOfSale
  );
}
