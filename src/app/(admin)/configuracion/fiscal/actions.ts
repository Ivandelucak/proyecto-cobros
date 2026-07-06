"use server";

import {
  FiscalCustomerCondition,
  FiscalDocumentIdentityType,
  FiscalDocumentLetter,
  FiscalEnvironment,
  FiscalIssueMode,
  type Prisma
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import { VOUCHER_TYPE_OPTIONS } from "@/lib/fiscal/arca/arca-config";
import {
  sanitizeArcaDetail,
  toArcaError
} from "@/lib/fiscal/arca/arca-errors";
import { getArcaAuthToken } from "@/lib/fiscal/arca/arca-wsaa";
import {
  getDocumentTypes,
  getLastAuthorizedVoucher,
  getVatTypes,
  getVoucherTypes,
  getWsfeServerStatus
} from "@/lib/fiscal/arca/arca-wsfe";
import {
  FISCAL_SETTING_ID,
  getFiscalSettingOrDefault,
  normalizePendingMinutes,
  normalizePointOfSale
} from "@/lib/fiscal/fiscal-settings";
import { taxSelectionFromOption } from "@/lib/fiscal/fiscal-tax";
import { prisma } from "@/lib/prisma";

export type FiscalSettingsState = {
  error?: string;
  success?: string;
};

export type ArcaTestState = {
  error?: string;
  success?: string;
  details?: string | null;
  result?: Array<{ label: string; value: string }>;
};

export async function updateFiscalSettingsAction(
  _prevState: FiscalSettingsState,
  formData: FormData
): Promise<FiscalSettingsState> {
  const user = await requireAdminPage();

  try {
    const pendingWarningMinutes = normalizePendingMinutes(
      readInt(formData, "pendingWarningMinutes", 30),
      30
    );
    const pendingCriticalMinutes = normalizePendingMinutes(
      readInt(formData, "pendingCriticalMinutes", 120),
      120
    );

    if (pendingCriticalMinutes < pendingWarningMinutes) {
      throw new Error("La alerta critica debe ser mayor o igual a la advertencia.");
    }

    const credentialUpdate = parseArcaCredentialUpdate(formData);
    const defaultTax = taxSelectionFromOption(readText(formData, "defaultFiscalTax"));
    const baseData = {
      enabled: isChecked(formData, "enabled"),
      environment: parseEnum(
        formData.get("environment"),
        FiscalEnvironment,
        FiscalEnvironment.HOMOLOGACION
      ),
      cuit: readOptionalText(formData, "cuit"),
      legalName: readOptionalText(formData, "legalName"),
      fiscalCondition: parseOptionalEnum(formData.get("fiscalCondition"), FiscalCustomerCondition),
      pointOfSale: normalizePointOfSale(readOptionalInt(formData, "pointOfSale")),
      defaultInvoiceLetter: parseOptionalEnum(
        formData.get("defaultInvoiceLetter"),
        FiscalDocumentLetter
      ),
      cashIssueMode: parseEnum(
        formData.get("cashIssueMode"),
        FiscalIssueMode,
        FiscalIssueMode.ASK
      ),
      electronicPaymentIssueMode: parseEnum(
        formData.get("electronicPaymentIssueMode"),
        FiscalIssueMode,
        FiscalIssueMode.AUTO
      ),
      currentAccountIssueMode: parseEnum(
        formData.get("currentAccountIssueMode"),
        FiscalIssueMode,
        FiscalIssueMode.ASK
      ),
      pendingWarningMinutes,
      pendingCriticalMinutes,
      allowCancelBeforeIssue: isChecked(formData, "allowCancelBeforeIssue"),
      requireCustomerForInvoiceA: isChecked(formData, "requireCustomerForInvoiceA"),
      defaultCustomerDocType: parseEnum(
        formData.get("defaultCustomerDocType"),
        FiscalDocumentIdentityType,
        FiscalDocumentIdentityType.CONSUMIDOR_FINAL
      ),
      defaultTaxTreatment: defaultTax?.treatment ?? null,
      defaultVatRate: defaultTax?.vatRate ?? null,
      defaultVatArcaCode: defaultTax?.vatArcaCode ?? null
    };

    const setting = await prisma.fiscalSetting.upsert({
      where: { businessId: user.businessId! },
      update: {
        ...baseData,
        ...credentialUpdate
      },
      create: {
        businessId: user.businessId!,
        ...baseData,
        arcaCertificatePem: credentialUpdate.arcaCertificatePem ?? null,
        arcaPrivateKeyPem: credentialUpdate.arcaPrivateKeyPem ?? null
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "FISCAL_SETTING_UPDATED",
      entity: "FiscalSetting",
      entityId: setting.id,
      description: "Actualizo configuracion fiscal preparatoria.",
      metadata: {
        enabled: setting.enabled,
        environment: setting.environment,
        pointOfSale: setting.pointOfSale,
        defaultTaxTreatment: setting.defaultTaxTreatment,
        defaultVatRate: setting.defaultVatRate?.toString() ?? null,
        defaultVatArcaCode: setting.defaultVatArcaCode,
        arcaCertificateUpdated: Boolean(credentialUpdate.arcaCertificatePem),
        arcaPrivateKeyUpdated: Boolean(credentialUpdate.arcaPrivateKeyPem)
      }
    });

    revalidatePath("/configuracion");
    revalidatePath("/configuracion/fiscal");
    revalidatePath("/caja");
    revalidatePath("/facturacion");

    return { success: "Configuracion fiscal guardada." };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuracion fiscal."
    };
  }
}

function maskCuit(cuit: string): string {
  const digits = cuit.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  return digits.substring(0, 2) + "*".repeat(digits.length - 3) + digits.slice(-1);
}

export async function testArcaWsaaAction(
  _prevState: ArcaTestState,
  _formData: FormData
): Promise<ArcaTestState> {
  const user = await requireAdminPage();
  const businessId = user.businessId;

  if (!businessId) {
    return { error: "No se identifico el comercio del usuario." };
  }

  try {
    const setting = await prisma.fiscalSetting.findUnique({
      where: { businessId },
      select: {
        id: true,
        cuit: true,
        arcaCertificatePem: true,
        arcaPrivateKeyPem: true,
        environment: true
      }
    });

    if (
      !setting ||
      !setting.cuit?.trim() ||
      !setting.arcaCertificatePem?.trim() ||
      !setting.arcaPrivateKeyPem?.trim() ||
      !setting.environment
    ) {
      return {
        error: "Configuración fiscal incompleta. Cargá CUIT, certificado y clave privada para probar WSAA."
      };
    }

    const auth = await getArcaAuthToken(businessId);
    const successMessage = auth.alreadyAuthenticated
      ? "ARCA informa que ya existe un Ticket de Acceso válido para este servicio."
      : auth.fromCache
        ? "Ya existe un token WSAA válido."
        : "Conexion WSAA homologacion exitosa.";

    await markArcaWsaaSuccess(businessId);

    await recordFiscalConnectivityEvent({
      userId: user.id,
      type: "ARCA_WSAA_TEST_OK",
      message: successMessage,
      metadata: {
        environment: auth.environment,
        service: "wsfe",
        expirationTime: auth.expirationTime.toISOString(),
        fromCache: auth.fromCache,
        alreadyAuthenticated: auth.alreadyAuthenticated
      }
    });
    await createAuditLog({
      userId: user.id,
      action: "ARCA_WSAA_TEST_OK",
      entity: "FiscalSetting",
      entityId: setting.id,
      description: successMessage,
      metadata: {
        expirationTime: auth.expirationTime.toISOString(),
        fromCache: auth.fromCache,
        alreadyAuthenticated: auth.alreadyAuthenticated
      }
    });

    revalidateFiscalPaths();

    return {
      success: successMessage,
      result: [
        { label: "Servicio", value: "wsfe" },
        { label: "CUIT", value: maskCuit(auth.cuit) },
        { label: "Vencimiento token", value: formatDateForUi(auth.expirationTime) }
      ]
    };
  } catch (error) {
    const arcaError = toArcaError(error, "No se pudo obtener token WSAA.");
    await markArcaFailure(businessId, "WSAA", arcaError.message, arcaError.details);
    await recordFiscalConnectivityEvent({
      userId: user.id,
      type: "ARCA_WSAA_TEST_FAILED",
      message: arcaError.message,
      metadata: { details: sanitizeArcaDetail(arcaError.details) }
    });

    revalidateFiscalPaths();

    return {
      error: arcaError.message,
      details: sanitizeArcaDetail(arcaError.details)
    };
  }
}

export async function testArcaWsfeStatusAction(
  _prevState: ArcaTestState,
  _formData: FormData
): Promise<ArcaTestState> {
  const user = await requireAdminPage();
  const businessId = user.businessId;

  if (!businessId) {
    return { error: "No se identifico el comercio del usuario." };
  }

  try {
    const setting = await prisma.fiscalSetting.findUnique({
      where: { businessId },
      select: {
        id: true,
        cuit: true,
        environment: true,
        arcaWsaaToken: true,
        arcaWsaaSign: true,
        arcaTokenExpiresAt: true
      }
    });

    const hasToken = Boolean(
      setting?.arcaWsaaToken &&
        setting?.arcaWsaaSign &&
        setting?.arcaTokenExpiresAt &&
        setting.arcaTokenExpiresAt.getTime() > Date.now()
    );

    if (
      !setting ||
      !setting.cuit?.trim() ||
      !setting.environment ||
      !hasToken
    ) {
      return {
        error: "Configuración fiscal incompleta. Primero configurá los datos fiscales y probá WSAA."
      };
    }

    const [status, documentTypes, voucherTypes, vatTypes] = await Promise.all([
      getWsfeServerStatus(businessId),
      getDocumentTypes(businessId),
      getVoucherTypes(businessId),
      getVatTypes(businessId)
    ]);

    await markArcaWsfeSuccess(businessId, "Estado WSFEv1 consultado correctamente.");
    await recordFiscalConnectivityEvent({
      userId: user.id,
      type: "ARCA_WSFE_TEST_OK",
      message: "Consulta WSFEv1 homologacion exitosa.",
      metadata: {
        appServer: status.appServer,
        dbServer: status.dbServer,
        authServer: status.authServer,
        documentTypes: documentTypes.length,
        voucherTypes: voucherTypes.length,
        vatTypes: vatTypes.length
      }
    });
    await createAuditLog({
      userId: user.id,
      action: "ARCA_WSFE_TEST_OK",
      entity: "FiscalSetting",
      entityId: setting.id,
      description: "Consulto WSFEv1 homologacion correctamente.",
      metadata: {
        appServer: status.appServer,
        dbServer: status.dbServer,
        authServer: status.authServer
      }
    });

    revalidateFiscalPaths();

    return {
      success: "Estado WSFEv1 consultado correctamente.",
      result: [
        { label: "AppServer", value: status.appServer },
        { label: "DbServer", value: status.dbServer },
        { label: "AuthServer", value: status.authServer },
        { label: "Tipos de documento", value: String(documentTypes.length) },
        { label: "Tipos de comprobante", value: String(voucherTypes.length) },
        { label: "Tipos de IVA", value: String(vatTypes.length) }
      ]
    };
  } catch (error) {
    const arcaError = toArcaError(error, "No se pudo consultar WSFEv1.");
    await markArcaFailure(businessId, "WSFE", arcaError.message, arcaError.details);
    await recordFiscalConnectivityEvent({
      userId: user.id,
      type: "ARCA_WSFE_TEST_FAILED",
      message: arcaError.message,
      metadata: { details: sanitizeArcaDetail(arcaError.details) }
    });

    revalidateFiscalPaths();

    return {
      error: arcaError.message,
      details: sanitizeArcaDetail(arcaError.details)
    };
  }
}

export async function queryLastArcaVoucherAction(
  _prevState: ArcaTestState,
  formData: FormData
): Promise<ArcaTestState> {
  const user = await requireAdminPage();
  const businessId = user.businessId;

  if (!businessId) {
    return { error: "No se identifico el comercio del usuario." };
  }

  try {
    const setting = await prisma.fiscalSetting.findUnique({
      where: { businessId },
      select: {
        id: true,
        cuit: true,
        pointOfSale: true,
        fiscalCondition: true,
        environment: true,
        arcaWsaaToken: true,
        arcaWsaaSign: true,
        arcaTokenExpiresAt: true
      }
    });

    const hasToken = Boolean(
      setting?.arcaWsaaToken &&
        setting?.arcaWsaaSign &&
        setting?.arcaTokenExpiresAt &&
        setting.arcaTokenExpiresAt.getTime() > Date.now()
    );

    if (
      !setting ||
      !setting.cuit?.trim() ||
      !setting.pointOfSale ||
      !setting.fiscalCondition ||
      !setting.environment ||
      !hasToken
    ) {
      return {
        error: "Configuración fiscal incompleta. Primero configurá los datos fiscales y probá WSAA."
      };
    }

    const voucherType = parseVoucherType(formData.get("voucherType"));
    const result = await getLastAuthorizedVoucher(businessId, {
      pointOfSale: setting.pointOfSale,
      voucherType
    });

    await markArcaWsfeSuccess(businessId, "Ultimo comprobante consultado correctamente.");
    await recordFiscalConnectivityEvent({
      userId: user.id,
      type: "ARCA_WSFE_TEST_OK",
      message: "Consulto ultimo comprobante autorizado en WSFEv1.",
      metadata: result
    });

    revalidateFiscalPaths();

    return {
      success: "Ultimo comprobante consultado correctamente.",
      result: [
        { label: "Punto de venta", value: String(result.pointOfSale) },
        { label: "Tipo comprobante", value: String(result.voucherType) },
        { label: "Ultimo numero", value: String(result.voucherNumber) }
      ]
    };
  } catch (error) {
    const arcaError = toArcaError(error, "No se pudo consultar ultimo comprobante.");
    await markArcaFailure(businessId, "WSFE", arcaError.message, arcaError.details);
    await recordFiscalConnectivityEvent({
      userId: user.id,
      type: "ARCA_WSFE_TEST_FAILED",
      message: arcaError.message,
      metadata: { details: sanitizeArcaDetail(arcaError.details) }
    });

    revalidateFiscalPaths();

    return {
      error: arcaError.message,
      details: sanitizeArcaDetail(arcaError.details)
    };
  }
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  return readText(formData, key) || null;
}

function parseArcaCredentialUpdate(formData: FormData) {
  const certificate = readOptionalPem(formData, "arcaCertificatePem");
  const privateKey = readOptionalPem(formData, "arcaPrivateKeyPem");
  const update: {
    arcaCertificatePem?: string;
    arcaPrivateKeyPem?: string;
    arcaWsaaToken?: null;
    arcaWsaaSign?: null;
    arcaTokenExpiresAt?: null;
    arcaLastError?: null;
  } = {};

  if (certificate) {
    if (!certificate.includes("BEGIN CERTIFICATE")) {
      throw new Error("El certificado debe estar en formato PEM.");
    }
    update.arcaCertificatePem = certificate;
  }

  if (privateKey) {
    if (!/BEGIN (RSA |EC |)?PRIVATE KEY/.test(privateKey)) {
      throw new Error("La clave privada debe estar en formato PEM.");
    }
    update.arcaPrivateKeyPem = privateKey;
  }

  if (certificate || privateKey) {
    update.arcaWsaaToken = null;
    update.arcaWsaaSign = null;
    update.arcaTokenExpiresAt = null;
    update.arcaLastError = null;
  }

  return update;
}

function readOptionalPem(formData: FormData, key: string) {
  const value = readText(formData, key)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  return value || null;
}

function readInt(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(readText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalInt(formData: FormData, key: string) {
  const text = readText(formData, key);
  if (!text) {
    return null;
  }

  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : null;
}

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseEnum<T extends Record<string, string>>(
  value: FormDataEntryValue | null,
  values: T,
  fallback: T[keyof T]
) {
  const text = String(value ?? "");
  return Object.values(values).includes(text) ? (text as T[keyof T]) : fallback;
}

function parseOptionalEnum<T extends Record<string, string>>(
  value: FormDataEntryValue | null,
  values: T
) {
  const text = String(value ?? "");
  return Object.values(values).includes(text) ? (text as T[keyof T]) : null;
}

function parseVoucherType(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  const allowed = VOUCHER_TYPE_OPTIONS.some((option) => option.code === parsed);

  return allowed ? parsed : 6;
}

async function markArcaFailure(
  businessId: string,
  scope: "WSAA" | "WSFE",
  message: string,
  details?: string
) {
  const data =
    scope === "WSAA"
      ? {
          arcaLastConnectionStatus: "ERROR",
          arcaLastConnectionTestAt: new Date(),
          arcaLastError: sanitizeArcaDetail(details) ?? message
        }
      : {
          arcaLastWsfeStatus: "ERROR",
          arcaLastWsfeTestAt: new Date(),
          arcaLastError: sanitizeArcaDetail(details) ?? message
        };

  await prisma.fiscalSetting.update({
    where: { businessId },
    data
  });
}

async function markArcaWsaaSuccess(businessId: string) {
  await prisma.fiscalSetting.update({
    where: { businessId },
    data: {
      arcaLastConnectionStatus: "OK",
      arcaLastConnectionTestAt: new Date(),
      arcaLastError: null
    }
  });
}

async function markArcaWsfeSuccess(businessId: string, message: string) {
  await prisma.fiscalSetting.update({
    where: { businessId },
    data: {
      arcaLastWsfeStatus: "OK",
      arcaLastWsfeTestAt: new Date(),
      arcaLastError: null
    }
  });
}

async function recordFiscalConnectivityEvent(input: {
  userId: string;
  type: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.fiscalEvent.create({
      data: {
        type: input.type,
        message: input.message,
        userId: input.userId,
        metadata: input.metadata ?? undefined
      }
    });
  } catch {
    // Los eventos fiscales no deben bloquear la prueba de conexion.
  }
}

function revalidateFiscalPaths() {
  revalidatePath("/configuracion/fiscal");
  revalidatePath("/facturacion");
}

function formatDateForUi(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}
