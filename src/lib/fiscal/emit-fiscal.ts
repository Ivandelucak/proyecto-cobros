import {
  FiscalDocumentStatus,
  FiscalStatus,
  SaleStatus,
  Prisma
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import {
  prepareFiscalDocumentDraft,
  recordFiscalEvent
} from "@/lib/fiscal/fiscal-engine";
import {
  getLastAuthorizedVoucher,
  requestCae
} from "@/lib/fiscal/arca/arca-wsfe";
import {
  mapVoucherType,
  mapDocumentTypeCode,
  formatArcaVoucherDate
} from "@/lib/fiscal/arca/arca-pre-emission";
import { normalizeFiscalError, ArcaError } from "@/lib/fiscal/arca/arca-errors";
import { resolveReceiverVatConditionId } from "@/lib/fiscal/fiscal-documents";


export async function emitFiscalDocument(saleId: string, userId: string) {
  const checkSale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      businessId: true,
      status: true,
      fiscalStatus: true,
      total: true,
      items: { select: { id: true } },
      fiscalDocument: {
        select: {
          id: true,
          status: true,
          type: true,
          letter: true,
          total: true,
          netAmount: true,
          vatAmount: true,
          exemptAmount: true,
          nonTaxedAmount: true,
          customerName: true,
          customerDocType: true,
          customerDocNumber: true,
          customerCondition: true,
          items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              vatRate: true,
              taxCode: true
            }
          }
        }
      }
    }
  });

  if (!checkSale) {
    throw new Error("La venta no existe.");
  }

  const businessId = checkSale.businessId;

  if (checkSale.status === SaleStatus.CANCELLED) {
    throw new Error("No se puede facturar una venta anulada.");
  }

  if (checkSale.fiscalStatus === FiscalStatus.ISSUED) {
    throw new Error("La venta ya fue emitida fiscalmente.");
  }

  if (checkSale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED) {
    throw new Error("La venta ya fue emitida fiscalmente y requiere nota de crédito.");
  }

  if (checkSale.items.length === 0) {
    throw new Error("La venta no tiene ítems para facturar.");
  }

  if (Number(checkSale.total) <= 0) {
    throw new Error("El total de la venta debe ser mayor a cero.");
  }

  const setting = await getFiscalSettingOrDefault(businessId);
  if (
    !setting.enabled ||
    !setting.cuit ||
    !setting.fiscalCondition ||
    !setting.pointOfSale ||
    !setting.hasArcaCertificatePem ||
    !setting.hasArcaPrivateKeyPem ||
    !setting.environment
  ) {
    throw new Error("Configuración fiscal incompleta. Revisá CUIT, certificado, clave privada y punto de venta.");
  }

  let fiscalDocument = checkSale.fiscalDocument;
  if (!fiscalDocument) {
    const draft = await prepareFiscalDocumentDraft(saleId, userId);
    const reloaded = await prisma.fiscalDocument.findUnique({
      where: { id: draft.id },
      include: { items: true }
    });
    if (!reloaded) {
      throw new Error("No se pudo preparar el borrador fiscal.");
    }
    fiscalDocument = reloaded;
  }

  if (fiscalDocument.status === FiscalDocumentStatus.ISSUED) {
    throw new Error("El comprobante ya fue emitido previamente.");
  }

  await prisma.$transaction([
    prisma.fiscalDocument.update({
      where: { id: fiscalDocument.id },
      data: { status: FiscalDocumentStatus.PENDING }
    }),
    prisma.sale.update({
      where: { id: saleId },
      data: { fiscalStatus: FiscalStatus.PENDING }
    })
  ]);

  try {
    const voucherTypeInfo = mapVoucherType(fiscalDocument.type, fiscalDocument.letter);
    if (voucherTypeInfo.code === null) {
      throw new Error(`Tipo y letra de comprobante (${fiscalDocument.type} ${fiscalDocument.letter}) sin mapeo ARCA inicial.`);
    }

    const lastVoucher = await getLastAuthorizedVoucher(businessId, {
      pointOfSale: setting.pointOfSale,
      voucherType: voucherTypeInfo.code
    });
    const nextNumber = lastVoucher.voucherNumber + 1;

    const docTypeCode = mapDocumentTypeCode(fiscalDocument.customerDocType ?? "CONSUMIDOR_FINAL");

    const vatGroupsMap = new Map<number, { id: number; baseImp: number; importe: number }>();
    for (const item of fiscalDocument.items) {
      if (item.vatRate !== null && item.taxCode !== null) {
        const vatArcaCode = Number(item.taxCode);
        const subtotal = Number(item.subtotal);
        const rate = Number(item.vatRate);
        const net = subtotal / (1 + rate / 100);
        const vat = subtotal - net;

        const existing = vatGroupsMap.get(vatArcaCode);
        if (existing) {
          existing.baseImp += net;
          existing.importe += vat;
        } else {
          vatGroupsMap.set(vatArcaCode, {
            id: vatArcaCode,
            baseImp: net,
            importe: vat
          });
        }
      }
    }

    const ivaList = Array.from(vatGroupsMap.values()).map((group) => ({
      id: group.id,
      baseImp: group.baseImp.toFixed(2),
      importe: group.importe.toFixed(2)
    }));

    const receiverVatConditionId = resolveReceiverVatConditionId(
      fiscalDocument.customerCondition,
      fiscalDocument.letter
    );

    const caeResult = await requestCae(businessId, {
      pointOfSale: setting.pointOfSale,
      voucherType: voucherTypeInfo.code,
      nextNumber,
      concepto: 1,
      docType: docTypeCode,
      docNro: fiscalDocument.customerDocNumber ?? "0",
      cbteFch: formatArcaVoucherDate(new Date()),
      impTotal: Number(fiscalDocument.total).toFixed(2),
      impTotConc: Number(fiscalDocument.nonTaxedAmount ?? 0).toFixed(2),
      impNeto: Number(fiscalDocument.netAmount ?? 0).toFixed(2),
      impOpEx: Number(fiscalDocument.exemptAmount ?? 0).toFixed(2),
      impTrib: "0.00",
      impIVA: Number(fiscalDocument.vatAmount ?? 0).toFixed(2),
      iva: ivaList,
      condicionIVAReceptorId: receiverVatConditionId
    });

    if (caeResult.result === "A") {
      await prisma.$transaction(async (tx) => {
        await tx.fiscalDocument.update({
          where: { id: fiscalDocument!.id },
          data: {
            status: FiscalDocumentStatus.ISSUED,
            number: nextNumber,
            cae: caeResult.cae,
            caeDueDate: caeResult.caeDueDate,
            issueDate: new Date(),
            responseJson: {
              rawResponse: caeResult.rawResponse,
              observations: caeResult.observations
            } as any,
            errorMessage: null
          }
        });

        await tx.sale.update({
          where: { id: saleId },
          data: {
            fiscalStatus: FiscalStatus.ISSUED,
            fiscalFailureReason: null,
            fiscalNotes: caeResult.observations.join("\n") || null
          }
        });

        await recordFiscalEvent(tx, {
          saleId,
          fiscalDocumentId: fiscalDocument!.id,
          userId,
          type: "ARCA_EMISSION_SUCCESS",
          message: `Comprobante emitido correctamente. CAE: ${caeResult.cae}, Nro: ${nextNumber}`,
          metadata: {
            pointOfSale: setting.pointOfSale,
            voucherType: voucherTypeInfo.code,
            number: nextNumber,
            cae: caeResult.cae,
            observations: caeResult.observations
          }
        });
      });

      return { success: true, cae: caeResult.cae, number: nextNumber };
    } else {
      const failReason = caeResult.observations.join(" | ") || "Solicitud rechazada por ARCA.";
      const normalized = normalizeFiscalError(failReason);
      normalized.technicalMessage = `Observaciones: ${caeResult.observations.join(" | ")}`;
      normalized.rawResponse = typeof caeResult.rawResponse === "string" ? caeResult.rawResponse : JSON.stringify(caeResult.rawResponse);

      await prisma.$transaction(async (tx) => {
        await tx.fiscalDocument.update({
          where: { id: fiscalDocument!.id },
          data: {
            status: FiscalDocumentStatus.FAILED,
            errorMessage: normalized.userMessage,
            responseJson: {
              rawResponse: caeResult.rawResponse,
              observations: caeResult.observations,
              errorDetails: normalized
            } as any
          }
        });

        await tx.sale.update({
          where: { id: saleId },
          data: {
            fiscalStatus: FiscalStatus.FAILED,
            fiscalFailureReason: normalized.userMessage
          }
        });

        await recordFiscalEvent(tx, {
          saleId,
          fiscalDocumentId: fiscalDocument!.id,
          userId,
          type: "ARCA_EMISSION_REJECTED",
          message: `Comprobante rechazado por ARCA: ${normalized.userMessage}`,
          metadata: {
            observations: caeResult.observations,
            errorDetails: normalized
          }
        });
      });

      return { success: false, error: normalized.userMessage, technicalError: normalized.technicalMessage };
    }
  } catch (err) {
    const normalized = normalizeFiscalError(err);
    
    // Tratamos de persistir de forma extremadamente segura (nunca fallar en el catch)
    try {
      await prisma.$transaction(async (tx) => {
        await tx.fiscalDocument.update({
          where: { id: fiscalDocument!.id },
          data: {
            status: FiscalDocumentStatus.FAILED,
            errorMessage: normalized.userMessage,
            responseJson: {
              errorDetails: normalized
            } as any
          }
        });

        await tx.sale.update({
          where: { id: saleId },
          data: {
            fiscalStatus: FiscalStatus.FAILED,
            fiscalFailureReason: normalized.userMessage
          }
        });

        await recordFiscalEvent(tx, {
          saleId,
          fiscalDocumentId: fiscalDocument!.id,
          userId,
          type: "ARCA_EMISSION_FAILED",
          message: `Error técnico en la emisión: ${normalized.userMessage}`,
          metadata: {
            errorDetails: normalized
          }
        });
      });
    } catch (dbErr) {
      // Si por alguna razón la transacción compleja fallara (ej. problemas de clave foránea o DB caída transitoria),
      // intentamos una última actualización directa de emergencia sin transacción y con valores ultra-seguros
      try {
        await prisma.fiscalDocument.update({
          where: { id: fiscalDocument!.id },
          data: {
            status: FiscalDocumentStatus.FAILED,
            errorMessage: "Error critico de emision y persistencia."
          }
        });
        await prisma.sale.update({
          where: { id: saleId },
          data: {
            fiscalStatus: FiscalStatus.FAILED,
            fiscalFailureReason: "Error critico de emision y persistencia."
          }
        });
      } catch (finalErr) {
        // Silenciar para no tapar el error original si falla absolutamente todo el sistema de DB
        console.error("Fallo critico final al intentar guardar estado FAILED:", finalErr);
      }
    }

    throw new ArcaError(normalized.userMessage, normalized.technicalMessage);
  }
}

