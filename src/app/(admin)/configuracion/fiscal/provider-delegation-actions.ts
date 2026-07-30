"use server";

import {
  FiscalConnectionMode,
  FiscalProviderVerificationStatus
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { verifyProviderDelegationConnection } from "@/lib/fiscal/arca/arca-wsfe";
import { getProviderCredentialsPublicStatus } from "@/lib/fiscal/provider-credentials.server";
import { prisma } from "@/lib/prisma";

export type ProviderDelegationState = {
  error?: string;
  success?: string;
};

export async function changeToProviderDelegationAction(
  _prevState: ProviderDelegationState,
  formData: FormData
): Promise<ProviderDelegationState> {
  if (formData.get("confirmProviderDelegation") !== "true") {
    return { error: "Confirmá el cambio de conexión para continuar." };
  }

  const user = await requireAdminPage();
  const setting = await getFiscalSettingForCurrentBusiness(user.businessId);
  if (!setting) {
    return { error: "Primero guardá los datos fiscales del comercio." };
  }
  if (setting.connectionMode === FiscalConnectionMode.PROVIDER_DELEGATION) {
    return { success: "La conexión administrada por Fox Point ya está seleccionada." };
  }

  await prisma.fiscalSetting.update({
    where: { id: setting.id },
    data: {
      connectionMode: FiscalConnectionMode.PROVIDER_DELEGATION,
      delegationDeclaredAt: null,
      providerVerificationStatus: FiscalProviderVerificationStatus.PENDING,
      providerVerifiedAt: null,
      providerLastVerificationAt: null,
      providerLastErrorCode: null
    }
  });
  await createAuditLog({
    userId: user.id,
    action: "FISCAL_PROVIDER_DELEGATION_SELECTED",
    entity: "FiscalSetting",
    entityId: setting.id,
    description: "El comercio eligió la conexión fiscal administrada por Fox Point."
  });
  revalidateFiscalPaths();

  return { success: "Podés continuar con los pasos de conexión de Fox Point." };
}

export async function changeToLegacyConnectionAction(
  _prevState: ProviderDelegationState,
  formData: FormData
): Promise<ProviderDelegationState> {
  if (formData.get("confirmLegacyConnection") !== "true") {
    return { error: "Confirmá el cambio de conexión para continuar." };
  }

  const user = await requireAdminPage();
  const setting = await getFiscalSettingForCurrentBusiness(user.businessId);
  if (!setting) {
    return { error: "No se encontró la configuración fiscal del comercio." };
  }
  if (setting.connectionMode === FiscalConnectionMode.LEGACY_PER_BUSINESS) {
    return { success: "La conexión configurada por comercio ya está seleccionada." };
  }

  await prisma.fiscalSetting.update({
    where: { id: setting.id },
    data: { connectionMode: FiscalConnectionMode.LEGACY_PER_BUSINESS }
  });
  await createAuditLog({
    userId: user.id,
    action: "FISCAL_LEGACY_CONNECTION_SELECTED",
    entity: "FiscalSetting",
    entityId: setting.id,
    description: "El comercio volvió a utilizar su conexión fiscal configurada por comercio."
  });
  revalidateFiscalPaths();

  return { success: "Volviste a utilizar la conexión configurada para este comercio." };
}

export async function declareProviderDelegationAction(
  _prevState: ProviderDelegationState,
  _formData: FormData
): Promise<ProviderDelegationState> {
  const user = await requireAdminPage();
  const setting = await getFiscalSettingForCurrentBusiness(user.businessId);
  if (!setting) {
    return { error: "Primero guardá los datos fiscales del comercio." };
  }
  if (setting.connectionMode !== FiscalConnectionMode.PROVIDER_DELEGATION) {
    return { error: "Seleccioná primero la conexión administrada por Fox Point." };
  }
  if (!hasMinimumFiscalData(setting)) {
    return { error: "Completá CUIT, condición fiscal y punto de venta antes de continuar." };
  }
  if (!getProviderCredentialsPublicStatus().configured) {
    return { error: "La conexión administrada por Fox Point todavía no está disponible." };
  }

  await prisma.fiscalSetting.update({
    where: { id: setting.id },
    data: {
      delegationDeclaredAt: new Date(),
      providerVerificationStatus: FiscalProviderVerificationStatus.PENDING,
      providerVerifiedAt: null,
      providerLastErrorCode: null
    }
  });
  await createAuditLog({
    userId: user.id,
    action: "FISCAL_PROVIDER_DELEGATION_DECLARED",
    entity: "FiscalSetting",
    entityId: setting.id,
    description: "El comercio informó que realizó la delegación fiscal."
  });
  revalidateFiscalPaths();

  return {
    success: "Delegación informada. Fox Point debe confirmar la autorización antes de verificarla."
  };
}

export async function verifyProviderDelegationAction(
  _prevState: ProviderDelegationState,
  _formData: FormData
): Promise<ProviderDelegationState> {
  const user = await requireAdminPage();
  const setting = await getFiscalSettingForCurrentBusiness(user.businessId);
  if (!setting) {
    return { error: "Primero guardá los datos fiscales del comercio." };
  }
  if (setting.connectionMode !== FiscalConnectionMode.PROVIDER_DELEGATION) {
    return { error: "Seleccioná primero la conexión administrada por Fox Point." };
  }
  if (!setting.delegationDeclaredAt) {
    return { error: "Confirmá primero que realizaste la delegación." };
  }
  if (!hasMinimumFiscalData(setting)) {
    return { error: "Completá CUIT, condición fiscal y punto de venta antes de verificar." };
  }
  if (!getProviderCredentialsPublicStatus().configured) {
    return { error: "La conexión administrada por Fox Point todavía no está disponible." };
  }

  try {
    const verification = await verifyProviderDelegationConnection(user.businessId!);
    const verifiedAt = new Date();
    await prisma.fiscalSetting.update({
      where: { id: setting.id },
      data: {
        providerVerificationStatus: FiscalProviderVerificationStatus.VERIFIED,
        providerVerifiedAt: verifiedAt,
        providerLastVerificationAt: verifiedAt,
        providerLastErrorCode: null
      }
    });
    await createAuditLog({
      userId: user.id,
      action: "FISCAL_PROVIDER_DELEGATION_VERIFIED",
      entity: "FiscalSetting",
      entityId: setting.id,
      description: "La conexión fiscal delegada fue verificada sin emitir comprobantes.",
      metadata: {
        pointOfSale: verification.pointOfSale,
        environment: verification.environment,
        tokenFromCache: verification.tokenFromCache
      }
    });
    revalidateFiscalPaths();
    return { success: "Conexión verificada correctamente." };
  } catch (error) {
    const code = providerVerificationErrorCode(error);
    await prisma.fiscalSetting.update({
      where: { id: setting.id },
      data: {
        providerVerificationStatus: FiscalProviderVerificationStatus.FAILED,
        providerLastVerificationAt: new Date(),
        providerLastErrorCode: code
      }
    });
    await createAuditLog({
      userId: user.id,
      action: "FISCAL_PROVIDER_DELEGATION_VERIFICATION_FAILED",
      entity: "FiscalSetting",
      entityId: setting.id,
      description: "No se pudo verificar la conexión fiscal delegada.",
      metadata: { code }
    });
    revalidateFiscalPaths();
    return { error: providerVerificationUserMessage(code) };
  }
}

async function getFiscalSettingForCurrentBusiness(businessId: string | null) {
  if (!businessId) {
    return null;
  }

  return prisma.fiscalSetting.findUnique({
    where: { businessId },
    select: {
      id: true,
      connectionMode: true,
      cuit: true,
      fiscalCondition: true,
      pointOfSale: true,
      delegationDeclaredAt: true
    }
  });
}

function hasMinimumFiscalData(setting: {
  cuit: string | null;
  fiscalCondition: string | null;
  pointOfSale: number | null;
}) {
  return Boolean(
    /^\d{11}$/.test((setting.cuit ?? "").replace(/\D/g, "")) &&
      setting.fiscalCondition &&
      setting.pointOfSale &&
      setting.pointOfSale > 0
  );
}

function providerVerificationErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("cuit") || message.includes("datos fiscales")) return "FISCAL_DATA_INVALID";
  if (message.includes("punto de venta")) return "POINT_OF_SALE_INVALID";
  if (message.includes("prestador") || message.includes("cache seguro")) return "PROVIDER_CONFIGURATION";
  if (message.includes("delegación")) return "DELEGATION_PENDING";
  if (message.includes("arca")) return "ARCA_REJECTED";
  return "VERIFICATION_FAILED";
}

function providerVerificationUserMessage(code: string) {
  const messages: Record<string, string> = {
    FISCAL_DATA_INVALID: "Revisá el CUIT y los datos fiscales del comercio.",
    POINT_OF_SALE_INVALID: "El punto de venta indicado no está disponible.",
    PROVIDER_CONFIGURATION: "La conexión administrada por Fox Point todavía no está disponible.",
    DELEGATION_PENDING: "Fox Point todavía no fue autorizado para operar por este CUIT.",
    ARCA_REJECTED: "Fox Point todavía no fue autorizado para operar por este CUIT.",
    VERIFICATION_FAILED: "No fue posible verificar la conexión. Intentá nuevamente."
  };

  return messages[code] ?? messages.VERIFICATION_FAILED;
}

function revalidateFiscalPaths() {
  revalidatePath("/configuracion/fiscal");
  revalidatePath("/configuracion");
  revalidatePath("/facturacion");
}
