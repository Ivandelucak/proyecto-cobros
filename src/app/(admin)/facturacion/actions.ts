"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  markSaleFiscalNotRequested,
  prepareFiscalDocumentDraft
} from "@/lib/fiscal/fiscal-engine";
import {
  runArcaPreflightValidation,
  type ArcaPreflightResult
} from "@/lib/fiscal/arca/arca-preflight";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { prisma } from "@/lib/prisma";
import { cancelSale } from "@/lib/sale-cancellation";
import { emitFiscalDocument } from "@/lib/fiscal/emit-fiscal";
import { normalizeFiscalError } from "@/lib/fiscal/arca/arca-errors";
import { consultFiscalDocumentInArca, getLastAuthorizedVoucher } from "@/lib/fiscal/arca/arca-wsfe";
import { mapVoucherType, mapDocumentTypeCode } from "@/lib/fiscal/arca/arca-pre-emission";

export type FiscalActionState = {
  error?: string;
  success?: string;
  technicalError?: string;
};

export type ArcaPreflightActionState = {
  error?: string;
  result?: ArcaPreflightResult;
};

export async function prepareFiscalDocumentAction(
  saleId: string,
  _state: FiscalActionState,
  _formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();

  try {
    const document = await prepareFiscalDocumentDraft(saleId, user.id);
    await createAuditLog({
      userId: user.id,
      action: "FISCAL_DOCUMENT_PREPARED",
      entity: "FiscalDocument",
      entityId: document.id,
      description: "Preparo factura interna sin emitir a ARCA.",
      metadata: { saleId }
    });
    revalidateFiscalPaths(saleId);
    return { success: "Factura preparada, pendiente de envio real a ARCA." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function markFiscalNotRequestedAction(
  saleId: string,
  _state: FiscalActionState,
  _formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();

  try {
    await markSaleFiscalNotRequested(saleId, user.id);
    await createAuditLog({
      userId: user.id,
      action: "FISCAL_MARK_NOT_REQUESTED",
      entity: "Sale",
      entityId: saleId,
      description: "Marco venta como no solicitada fiscalmente."
    });
    revalidateFiscalPaths(saleId);
    return { success: "Venta marcada como ticket interno." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function cancelFiscalBeforeIssueAction(
  saleId: string,
  _state: FiscalActionState,
  formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    if (!reason) {
      throw new Error("El motivo es obligatorio.");
    }

    const result = await cancelSale({ saleId, userId: user.id, reason });
    await createAuditLog({
      userId: user.id,
      action:
        result.status === "credit_note_required"
          ? "FISCAL_CREDIT_NOTE_REQUIRED"
          : "FISCAL_CANCELLED_BEFORE_ISSUE",
      entity: "Sale",
      entityId: saleId,
      description:
        result.status === "credit_note_required"
          ? "Marco venta emitida como pendiente de nota de credito."
          : "Cancelo venta antes de emitir comprobante fiscal.",
      metadata: { reason }
    });
    revalidateFiscalPaths(saleId);
    return {
      success:
        result.status === "credit_note_required"
          ? "La venta ya fue emitida fiscalmente. Requiere nota de credito."
          : "Venta anulada antes de emitir comprobante fiscal."
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function executeArcaPreflightAction(
  saleId: string,
  _state: ArcaPreflightActionState,
  _formData: FormData
): Promise<ArcaPreflightActionState> {
  const user = await requireAdminPage();

  try {
    const [sale, setting] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          fiscalDocument: {
            include: {
              items: true
            }
          }
        }
      }),
      getFiscalSettingOrDefault(user.businessId ?? undefined)
    ]);

    const result = await runArcaPreflightValidation({
      sale,
      fiscalDocument: sale?.fiscalDocument ?? null,
      setting,
      requireConnectionCredentials: true,
      businessId: user.businessId ?? undefined
    });

    await createAuditLog({
      userId: user.id,
      action: result.canProceedToEmissionFuture
        ? "ARCA_PREFLIGHT_OK"
        : "ARCA_PREFLIGHT_FAILED",
      entity: "Sale",
      entityId: saleId,
      description: result.canProceedToEmissionFuture
        ? "Ejecuto preflight ARCA sin errores bloqueantes."
        : "Ejecuto preflight ARCA con errores bloqueantes.",
      metadata: {
        pointOfSale: result.pointOfSale,
        voucherType: result.voucherType,
        lastAuthorizedNumber: result.lastAuthorizedNumber,
        nextEstimatedNumber: result.nextEstimatedNumber,
        errors: result.errors,
        warnings: result.warnings
      }
    });

    revalidateFiscalPaths(saleId);

    return { result };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

function revalidateFiscalPaths(saleId: string) {
  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${saleId}`);
  revalidatePath(`/ventas/${saleId}`);
  revalidatePath(`/ventas/${saleId}/ticket`);
  revalidatePath("/ventas");
  revalidatePath("/admin");
}

export async function emitFiscalDocumentAction(
  saleId: string,
  _state: FiscalActionState,
  _formData: FormData
): Promise<FiscalActionState> {
  const user = await requireAdminPage();

  try {
    const result = await emitFiscalDocument(saleId, user.id);
    revalidateFiscalPaths(saleId);
    if (result.success) {
      return { success: `Comprobante emitido con éxito. CAE: ${result.cae}, Nro: ${result.number}` };
    } else {
      return { error: result.error, technicalError: (result as any).technicalError };
    }
  } catch (error) {
    const normalized = normalizeFiscalError(error);
    return { error: normalized.userMessage, technicalError: normalized.technicalMessage };
  }
}

export type SaleConfirmationDetails = {
  saleNumber: number;
  total: number;
  customerName: string;
  environment: FiscalEnvironment;
  pointOfSale: number | null;
  voucherTypeLabel: string;
  condicionIVAReceptorId?: number;
  condicionIVAReceptorLabel?: string;
};

import { FiscalEnvironment, FiscalDocumentStatus } from "@prisma/client";
import { determineFiscalDocumentTypeAndLetter, resolveReceiverVatConditionId } from "@/lib/fiscal/fiscal-documents";

export async function getSaleForConfirmationModalAction(saleId: string): Promise<SaleConfirmationDetails | null> {
  const user = await requireAdminPage();

  try {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId: user.businessId! },
      select: {
        saleNumber: true,
        total: true,
        customer: { select: { name: true, businessName: true, fiscalCondition: true } },
        fiscalCustomerNameSnapshot: true,
        fiscalCustomerCondition: true
      }
    });

    if (!sale) return null;

    const setting = await getFiscalSettingOrDefault(user.businessId!);
    const customerCondition = sale.fiscalCustomerCondition ?? sale.customer?.fiscalCondition ?? null;
    const documentShape = determineFiscalDocumentTypeAndLetter({
      setting,
      customerCondition
    });
    const voucherTypeInfo = mapVoucherType(documentShape.type, documentShape.letter);

    let typeLabel = voucherTypeInfo.label ?? "Comprobante";
    const letter = documentShape.letter;
    if (letter && !typeLabel.endsWith(` ${letter}`)) {
      typeLabel = `${typeLabel} ${letter}`;
    }

    const condicionIVAReceptorId = resolveReceiverVatConditionId(customerCondition, documentShape.letter);
    const labelsMap: Record<number, string> = {
      1: "Responsable Inscripto",
      4: "Exento",
      5: "Consumidor Final",
      6: "Monotributo",
      7: "Sujeto No Categorizado",
      13: "Monotributista Social",
      15: "IVA No Alcanzado",
      16: "Monotributo Promovido"
    };
    const condicionIVAReceptorLabel = `${labelsMap[condicionIVAReceptorId] ?? "Otro"} (${condicionIVAReceptorId})`;

    return {
      saleNumber: sale.saleNumber,
      total: Number(sale.total),
      customerName: sale.fiscalCustomerNameSnapshot ?? sale.customer?.businessName ?? sale.customer?.name ?? "Consumidor final",
      environment: setting.environment,
      pointOfSale: setting.pointOfSale,
      voucherTypeLabel: typeLabel,
      condicionIVAReceptorId,
      condicionIVAReceptorLabel
    };
  } catch (error) {
    console.error("Error al obtener detalles de confirmacion:", error);
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la accion fiscal.";
}

export type VerificationDiff = {
  field: string;
  local: string;
  arca: string;
  match: boolean;
};

export type VerificationActionResult = {
  success?: boolean;
  error?: string;
  technicalError?: string;
  message?: string;
  diffs?: VerificationDiff[];
  details?: {
    cae: string | null;
    caeDueDate: string | null;
    cbteFch: string | null;
    impTotal: string | null;
    pointOfSale: number | null;
    voucherType: number | null;
    voucherNumber: number | null;
  };
};

function formatDateToYyyymmdd(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date).replace(/-/g, "");
}

export async function verifyFiscalDocumentInArcaAction(
  saleId: string
): Promise<VerificationActionResult> {
  const user = await requireAdminPage();

  try {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId: user.businessId! },
      include: {
        fiscalDocument: true
      }
    });

    if (!sale) {
      return { error: "Venta no encontrada." };
    }

    const fiscalDocument = sale.fiscalDocument;
    if (!fiscalDocument) {
      return { error: "La venta no tiene ningún comprobante fiscal asociado." };
    }

    if (fiscalDocument.status !== FiscalDocumentStatus.ISSUED) {
      return { error: "El comprobante fiscal no está en estado emitido (ISSUED)." };
    }

    if (
      !fiscalDocument.cae ||
      fiscalDocument.pointOfSale === null ||
      fiscalDocument.number === null ||
      !fiscalDocument.type ||
      !fiscalDocument.letter
    ) {
      return { error: "Datos del comprobante incompletos para realizar la verificación en ARCA." };
    }

    const voucherTypeInfo = mapVoucherType(fiscalDocument.type, fiscalDocument.letter);
    if (voucherTypeInfo.code === null) {
      return { error: `Tipo de comprobante ${fiscalDocument.type} ${fiscalDocument.letter} no soportado para consulta.` };
    }

    // Consult ARCA
    const arcaData = await consultFiscalDocumentInArca(user.businessId!, {
      pointOfSale: fiscalDocument.pointOfSale,
      voucherType: voucherTypeInfo.code,
      voucherNumber: fiscalDocument.number
    });

    // Comparar
    const localVoucherCode = voucherTypeInfo.code;
    const diffs: VerificationDiff[] = [
      {
        field: "CAE",
        local: fiscalDocument.cae ?? "-",
        arca: arcaData.cae ?? "-",
        match: fiscalDocument.cae === arcaData.cae
      },
      {
        field: "Vencimiento CAE",
        local: fiscalDocument.caeDueDate ? formatDateToYyyymmdd(fiscalDocument.caeDueDate) : "-",
        arca: arcaData.caeDueDate ? formatDateToYyyymmdd(arcaData.caeDueDate) : "-",
        match: (fiscalDocument.caeDueDate && arcaData.caeDueDate)
          ? formatDateToYyyymmdd(fiscalDocument.caeDueDate) === formatDateToYyyymmdd(arcaData.caeDueDate)
          : false
      },
      {
        field: "Tipo de comprobante",
        local: String(localVoucherCode ?? "-"),
        arca: String(arcaData.voucherType ?? "-"),
        match: localVoucherCode === arcaData.voucherType
      },
      {
        field: "Punto de venta",
        local: String(fiscalDocument.pointOfSale ?? "-"),
        arca: String(arcaData.pointOfSale ?? "-"),
        match: fiscalDocument.pointOfSale === arcaData.pointOfSale
      },
      {
        field: "Número",
        local: String(fiscalDocument.number ?? "-"),
        arca: String(arcaData.voucherNumber ?? "-"),
        match: fiscalDocument.number === arcaData.voucherNumber
      },
      {
        field: "Importe total",
        local: `$${Number(fiscalDocument.total).toFixed(2)}`,
        arca: `$${Number(arcaData.impTotal).toFixed(2)}`,
        match: Number(fiscalDocument.total).toFixed(2) === Number(arcaData.impTotal).toFixed(2)
      },
      {
        field: "Fecha comprobante",
        local: fiscalDocument.issueDate ? formatDateToYyyymmdd(fiscalDocument.issueDate) : "-",
        arca: arcaData.cbteFch ?? "-",
        match: fiscalDocument.issueDate ? formatDateToYyyymmdd(fiscalDocument.issueDate) === arcaData.cbteFch : false
      }
    ];

    const localDocType = fiscalDocument.customerDocType ? mapDocumentTypeCode(fiscalDocument.customerDocType) : 99;
    const arcaDocType = arcaData.docTipo ?? 99;
    diffs.push({
      field: "Tipo doc. receptor",
      local: String(localDocType),
      arca: String(arcaDocType),
      match: localDocType === arcaDocType
    });

    const localDocNro = fiscalDocument.customerDocNumber ? fiscalDocument.customerDocNumber.trim() : "0";
    const arcaDocNro = arcaData.docNro ? arcaData.docNro.trim() : "0";
    diffs.push({
      field: "Documento receptor",
      local: localDocNro,
      arca: arcaDocNro,
      match: localDocNro === arcaDocNro
    });

    const allMatch = diffs.every(d => d.match);
    const message = allMatch
      ? "Comprobante verificado correctamente en ARCA."
      : "ARCA respondió un comprobante, pero hay diferencias con lo guardado.";

    // Guardar evento
    await prisma.fiscalEvent.create({
      data: {
        saleId: sale.id,
        fiscalDocumentId: fiscalDocument.id,
        type: "VERIFY",
        message: message,
        metadata: {
          status: allMatch ? "SUCCESS" : "FAILED",
          message: message.substring(0, 150),
          diffs: diffs.map(d => ({
            field: d.field,
            match: d.match,
            local: d.local,
            arca: d.arca
          }))
        },
        userId: user.id
      }
    });

    revalidateFiscalPaths(saleId);

    return {
      success: allMatch,
      message,
      diffs,
      details: {
        cae: arcaData.cae,
        caeDueDate: arcaData.caeDueDate ? arcaData.caeDueDate.toISOString() : null,
        cbteFch: arcaData.cbteFch,
        impTotal: arcaData.impTotal,
        pointOfSale: arcaData.pointOfSale,
        voucherType: arcaData.voucherType,
        voucherNumber: arcaData.voucherNumber
      }
    };
  } catch (error) {
    const normalized = normalizeFiscalError(error);

    // Log exception event
    try {
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, businessId: user.businessId! },
        include: { fiscalDocument: true }
      });
      if (sale?.fiscalDocument) {
        await prisma.fiscalEvent.create({
          data: {
            saleId: sale.id,
            fiscalDocumentId: sale.fiscalDocument.id,
            type: "VERIFY",
            message: `Error al verificar: ${normalized.userMessage.substring(0, 200)}`,
            metadata: {
              status: "ERROR",
              error: normalized.userMessage,
              technicalMessage: normalized.technicalMessage
            },
            userId: user.id
          }
        });
      }
    } catch (dbErr) {
      console.error("No se pudo registrar FiscalEvent para error de verificación:", dbErr);
    }

    return {
      success: false,
      error: normalized.userMessage,
      technicalError: normalized.technicalMessage
    };
  }
}

export async function getLastAuthorizedVoucherAction(
  saleId: string
): Promise<{
  success?: boolean;
  error?: string;
  voucherNumber?: number;
}> {
  const user = await requireAdminPage();

  try {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId: user.businessId! },
      include: { fiscalDocument: true }
    });

    if (!sale || !sale.fiscalDocument) {
      return { error: "Venta o comprobante no encontrado." };
    }

    const { pointOfSale, type, letter } = sale.fiscalDocument;
    if (pointOfSale === null || !type || !letter) {
      return { error: "Punto de venta o tipo de comprobante no configurado." };
    }

    const voucherTypeInfo = mapVoucherType(type, letter);
    if (voucherTypeInfo.code === null) {
      return { error: "Tipo de comprobante no soportado." };
    }

    const result = await getLastAuthorizedVoucher(user.businessId!, {
      pointOfSale,
      voucherType: voucherTypeInfo.code
    });

    return {
      success: true,
      voucherNumber: result.voucherNumber
    };
  } catch (error) {
    const normalized = normalizeFiscalError(error);
    return {
      error: normalized.userMessage
    };
  }
}
