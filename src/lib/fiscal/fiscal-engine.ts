import {
  FiscalDocumentIdentityType,
  FiscalDocumentStatus,
  FiscalStatus,
  SaleStatus,
  type Prisma
} from "@prisma/client";
import {
  determineFiscalDocumentTypeAndLetter,
  validateFiscalReadiness
} from "@/lib/fiscal/fiscal-documents";
import { calculateFiscalAmountsForSale } from "@/lib/fiscal/fiscal-amounts";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
import type { FiscalRequirementDecision } from "@/lib/fiscal/fiscal-policy";
import { prisma } from "@/lib/prisma";

type FiscalEngineClient = Prisma.TransactionClient | typeof prisma;

type FiscalEventInput = {
  saleId?: string | null;
  fiscalDocumentId?: string | null;
  type: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string | null;
};

export async function applyFiscalDecisionToSale(
  client: FiscalEngineClient,
  saleId: string,
  decision: FiscalRequirementDecision,
  userId?: string | null
) {
  await client.sale.update({
    where: { id: saleId },
    data: {
      requiresFiscalInvoice: decision.requiresFiscalInvoice,
      fiscalStatus: decision.fiscalStatus,
      fiscalRequestedAt: decision.fiscalRequestedAt,
      fiscalFailureReason: null
    }
  });

  await recordFiscalEvent(client, {
    saleId,
    userId,
    type: decision.requiresFiscalInvoice
      ? "FISCAL_MARK_PENDING"
      : "FISCAL_MARK_NOT_REQUESTED",
    message: decision.requiresFiscalInvoice
      ? "Venta marcada como pendiente de facturacion."
      : "Venta marcada como ticket interno sin solicitud fiscal.",
    metadata: {
      decisionSource: decision.decisionSource,
      fiscalStatus: decision.fiscalStatus
    }
  });
}

export async function markSaleFiscalPending(saleId: string, userId?: string | null) {
  return prisma.$transaction(async (tx) => markSaleFiscalPendingTx(tx, saleId, userId));
}

export async function markSaleFiscalPendingTx(
  client: FiscalEngineClient,
  saleId: string,
  userId?: string | null
) {
  const sale = await client.sale.findUnique({
    where: { id: saleId },
    select: {
      status: true,
      fiscalStatus: true,
      fiscalDocument: { select: { status: true } }
    }
  });

  if (!sale) {
    throw new Error("Venta no encontrada.");
  }

  if (sale.status === SaleStatus.CANCELLED) {
    throw new Error("No se puede marcar una venta anulada como pendiente fiscal.");
  }

  if (
    sale.fiscalStatus === FiscalStatus.ISSUED ||
    sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED ||
    sale.fiscalStatus === FiscalStatus.CANCELLED_BY_CREDIT_NOTE ||
    sale.fiscalDocument?.status === FiscalDocumentStatus.ISSUED
  ) {
    throw new Error("No se puede cambiar el estado fiscal de una venta emitida.");
  }

  await client.sale.update({
    where: { id: saleId },
    data: {
      requiresFiscalInvoice: true,
      fiscalStatus: FiscalStatus.PENDING,
      fiscalRequestedAt: new Date(),
      fiscalFailureReason: null
    }
  });

  await recordFiscalEvent(client, {
    saleId,
    userId,
    type: "FISCAL_MARK_PENDING",
    message: "Venta marcada como pendiente de facturacion."
  });
}

export async function markSaleFiscalNotRequested(
  saleId: string,
  userId?: string | null
) {
  return prisma.$transaction(async (tx) =>
    markSaleFiscalNotRequestedTx(tx, saleId, userId)
  );
}

export async function markSaleFiscalNotRequestedTx(
  client: FiscalEngineClient,
  saleId: string,
  userId?: string | null
) {
  const sale = await client.sale.findUnique({
    where: { id: saleId },
    select: {
      status: true,
      fiscalStatus: true,
      fiscalDocument: { select: { status: true } }
    }
  });

  if (!sale) {
    throw new Error("Venta no encontrada.");
  }

  if (sale.status === SaleStatus.CANCELLED) {
    throw new Error("No se puede marcar una venta anulada como ticket interno.");
  }

  if (
    sale.fiscalStatus !== FiscalStatus.PENDING &&
    sale.fiscalStatus !== FiscalStatus.FAILED
  ) {
    throw new Error("Solo se pueden marcar como ticket interno ventas pendientes o fallidas.");
  }

  if (sale.fiscalDocument?.status === FiscalDocumentStatus.ISSUED) {
    throw new Error("No se puede cambiar el estado fiscal de una venta emitida.");
  }

  await client.sale.update({
    where: { id: saleId },
    data: {
      requiresFiscalInvoice: false,
      fiscalStatus: FiscalStatus.NOT_REQUESTED,
      fiscalRequestedAt: null,
      fiscalFailureReason: null
    }
  });

  await recordFiscalEvent(client, {
    saleId,
    userId,
    type: "FISCAL_MARK_NOT_REQUESTED",
    message: "Venta marcada como no solicitada fiscalmente."
  });
}

export async function prepareFiscalDocumentDraft(
  saleId: string,
  userId?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                taxTreatment: true,
                vatRate: true,
                vatArcaCode: true
              }
            }
          }
        },
        payments: true
      }
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    const setting = await getFiscalSettingOrDefault(sale.businessId ?? undefined, tx);



    if (sale.fiscalStatus === FiscalStatus.ISSUED) {
      throw new Error("La venta ya fue emitida fiscalmente.");
    }

    if (sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED) {
      throw new Error("La venta requiere nota de credito.");
    }

    const readiness = await validateFiscalReadiness(sale.id, tx);
    if (readiness.errors.length > 0) {
      throw new Error(readiness.errors.join(" "));
    }

    const customerSnapshot = buildFiscalCustomerSnapshot(
      sale.customer,
      setting.defaultCustomerDocType
    );
    const documentShape = determineFiscalDocumentTypeAndLetter({
      setting,
      customerCondition: customerSnapshot.condition
    });
    const fiscalAmounts = calculateFiscalAmountsForSale({
      items: sale.items.map((item) => ({
        id: item.id,
        description: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        unitType: item.unitTypeSnapshot,
        product: item.product
      })),
      setting,
      documentLetter: documentShape.letter
    });

    if (fiscalAmounts.errors.length > 0) {
      throw new Error(fiscalAmounts.errors.join(" "));
    }

    const fiscalAmountItemsById = new Map(
      fiscalAmounts.items.map((item) => [item.id, item])
    );
    const documentData = {
      saleId: sale.id,
      type: documentShape.type,
      letter: documentShape.letter,
      status: FiscalDocumentStatus.DRAFT,
      environment: setting.environment,
      pointOfSale: setting.pointOfSale,
      number: null,
      cae: null,
      caeDueDate: null,
      issueDate: null,
      total: fiscalAmounts.totals.impTotal,
      netAmount: fiscalAmounts.totals.impNeto,
      vatAmount: fiscalAmounts.totals.impIVA,
      exemptAmount: fiscalAmounts.totals.impOpEx,
      nonTaxedAmount: fiscalAmounts.totals.impTotConc,
      customerName: customerSnapshot.name,
      customerDocType: customerSnapshot.docType,
      customerDocNumber: customerSnapshot.docNumber,
      customerCondition: customerSnapshot.condition,
      requestJson: {
        preparedOnly: true,
        saleId: sale.id,
        internalSaleNumber: formatInternalSaleNumber(sale),
        paymentMethods: sale.payments.map((payment) => payment.method),
        fiscalAmountWarnings: fiscalAmounts.warnings,
        note: "Borrador interno. No enviado a ARCA."
      },
      errorMessage: null
    };

    const existingDocument = await tx.fiscalDocument.findFirst({
      where: { saleId: sale.id, type: documentShape.type },
      select: { id: true, status: true }
    });

    if (existingDocument?.status === FiscalDocumentStatus.ISSUED) {
      throw new Error("No se puede regenerar un comprobante fiscal emitido.");
    }

    const fiscalDocument = existingDocument
      ? await tx.fiscalDocument.update({
          where: { id: existingDocument.id },
          data: documentData
        })
      : await tx.fiscalDocument.create({
          data: documentData
        });

    await tx.fiscalDocumentItem.deleteMany({
      where: { fiscalDocumentId: fiscalDocument.id }
    });

    if (sale.items.length > 0) {
      await tx.fiscalDocumentItem.createMany({
        data: sale.items.map((item) => {
          const fiscalAmountItem = fiscalAmountItemsById.get(item.id);

          if (!fiscalAmountItem) {
            throw new Error(`No se pudo calcular IVA para "${item.productNameSnapshot}".`);
          }

          return {
            fiscalDocumentId: fiscalDocument.id,
            description: item.productNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            vatRate: fiscalAmountItem.vatRate,
            taxCode:
              fiscalAmountItem.vatArcaCode === null
                ? null
                : String(fiscalAmountItem.vatArcaCode),
            taxTreatment: fiscalAmountItem.taxTreatment
          };
        })
      });
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        requiresFiscalInvoice: true,
        fiscalStatus: FiscalStatus.READY_TO_ISSUE,
        fiscalRequestedAt: sale.fiscalRequestedAt ?? new Date(),
        fiscalDocumentId: fiscalDocument.id,
        fiscalCustomerNameSnapshot: customerSnapshot.name,
        fiscalCustomerDocType: customerSnapshot.docType,
        fiscalCustomerDocNumber: customerSnapshot.docNumber,
        fiscalCustomerCondition: customerSnapshot.condition,
        fiscalFailureReason: null
      }
    });

    await recordFiscalEvent(tx, {
      saleId: sale.id,
      fiscalDocumentId: fiscalDocument.id,
      userId,
      type: "FISCAL_DOCUMENT_PREPARED",
      message: "Factura preparada como borrador interno.",
      metadata: {
        preparedOnly: true,
        environment: setting.environment,
        pointOfSale: setting.pointOfSale,
        letter: documentData.letter
      }
    });

    return fiscalDocument;
  });
}

export async function cancelFiscalBeforeIssue(
  saleId: string,
  userId: string,
  reason: string
) {
  return prisma.$transaction(async (tx) =>
    cancelFiscalBeforeIssueTx(tx, saleId, userId, reason)
  );
}

export async function cancelFiscalBeforeIssueTx(
  client: FiscalEngineClient,
  saleId: string,
  userId: string,
  reason: string
) {
  await client.fiscalDocument.updateMany({
    where: {
      saleId,
      status: { not: FiscalDocumentStatus.ISSUED }
    },
    data: {
      status: FiscalDocumentStatus.CANCELLED,
      errorMessage: null
    }
  });

  await client.sale.update({
    where: { id: saleId },
    data: {
      fiscalStatus: FiscalStatus.CANCELLED_BEFORE_ISSUE,
      requiresFiscalInvoice: false,
      fiscalCancelledAt: new Date(),
      fiscalFailureReason: null,
      fiscalNotes: reason
    }
  });

  await recordFiscalEvent(client, {
    saleId,
    userId,
    type: "FISCAL_CANCELLED_BEFORE_ISSUE",
    message: "Venta anulada antes de emitir comprobante fiscal.",
    metadata: { reason }
  });
}

export async function markCreditNoteRequired(
  saleId: string,
  userId: string,
  reason: string
) {
  return prisma.$transaction(async (tx) =>
    markCreditNoteRequiredTx(tx, saleId, userId, reason)
  );
}

export async function markCreditNoteRequiredTx(
  client: FiscalEngineClient,
  saleId: string,
  userId: string,
  reason: string
) {
  await client.sale.update({
    where: { id: saleId },
    data: {
      fiscalStatus: FiscalStatus.CREDIT_NOTE_REQUIRED,
      requiresFiscalInvoice: true,
      fiscalFailureReason: reason
    }
  });

  await recordFiscalEvent(client, {
    saleId,
    userId,
    type: "FISCAL_CREDIT_NOTE_REQUIRED",
    message: "La venta emitida requiere nota de credito.",
    metadata: { reason }
  });
}

export async function recordFiscalEvent(
  client: FiscalEngineClient,
  input: FiscalEventInput
) {
  try {
    let safeMessage = input.message || "";
    // Truncar para mantener el mensaje corto y humano
    if (safeMessage.length > 500) {
      safeMessage = safeMessage.slice(0, 497) + "...";
    }
    // Limpiar partes sensibles del mensaje por seguridad
    safeMessage = safeMessage
      .replace(/<(?:[\w-]+:)?token\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?token>/gi, "<token>[oculto]</token>")
      .replace(/<(?:[\w-]+:)?sign\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?sign>/gi, "<sign>[oculto]</sign>")
      .replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, "[PEM oculto]");

    let safeMetadata = input.metadata;
    if (safeMetadata && typeof safeMetadata === "object") {
      try {
        const str = JSON.stringify(safeMetadata);
        const cleanedStr = str
          .replace(/<(?:[\w-]+:)?token\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?token>/gi, "<token>[oculto]</token>")
          .replace(/<(?:[\w-]+:)?sign\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?sign>/gi, "<sign>[oculto]</sign>")
          .replace(/<(?:[\w-]+:)?in0\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?in0>/gi, "<in0>[CMS oculto]</in0>")
          .replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, "[PEM oculto]");
        safeMetadata = JSON.parse(cleanedStr);
      } catch (e) {
        console.error("Error al sanitizar metadata en recordFiscalEvent:", e);
      }
    }

    return await client.fiscalEvent.create({
      data: {
        saleId: input.saleId ?? null,
        fiscalDocumentId: input.fiscalDocumentId ?? null,
        type: input.type,
        message: safeMessage,
        metadata: safeMetadata !== undefined ? safeMetadata : undefined,
        userId: input.userId ?? null
      }
    });
  } catch (eventError) {
    // BLINDADO: Nunca lanzar error que rompa la emision
    console.error("No se pudo registrar evento fiscal (blindado):", eventError);
    return null;
  }
}


function buildFiscalCustomerSnapshot(
  customer:
    | {
        name: string;
        document: string | null;
        fiscalCondition: import("@prisma/client").FiscalCustomerCondition | null;
        docType: FiscalDocumentIdentityType | null;
        docNumber: string | null;
        businessName: string | null;
      }
    | null,
  defaultDocType: FiscalDocumentIdentityType
) {
  return {
    name: customer?.businessName || customer?.name || "Consumidor final",
    docType: customer?.docType ?? defaultDocType,
    docNumber: customer?.docNumber || customer?.document || null,
    condition: customer?.fiscalCondition ?? null
  };
}
