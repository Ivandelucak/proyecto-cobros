import {
  FiscalCustomerCondition,
  FiscalDocumentIdentityType,
  FiscalDocumentLetter,
  FiscalDocumentStatus,
  FiscalDocumentType,
  FiscalEnvironment,
  FiscalTaxTreatment,
  SaleStatus,
  type FiscalStatus,
  Prisma,
  type UnitType
} from "@prisma/client";
import { calculateFiscalAmountsForSale } from "@/lib/fiscal/fiscal-amounts";
import { fiscalTaxTreatmentLabel } from "@/lib/fiscal/fiscal-tax";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import { resolveReceiverVatConditionId } from "@/lib/fiscal/fiscal-documents";

const ARCA_SERVICE = "WSFEv1";
const FUTURE_OPERATION = "FECAESolicitar";
const DEFAULT_CURRENCY = "PES";
const DEFAULT_CURRENCY_RATE = "1.000000";
const TOKEN_WARNING_WINDOW_MS = 10 * 60 * 1000;

export type ArcaPreEmissionValidation = {
  errors: string[];
  warnings: string[];
};

export type ArcaInvoiceRequestPreview = {
  meta: {
    preparedOnly: true;
    environment: FiscalEnvironment;
    service: typeof ARCA_SERVICE;
    futureOperation: typeof FUTURE_OPERATION;
    generatedAt: string;
    saleId: string;
    saleNumber: number;
    fiscalDocumentId: string;
  };
  issuer: {
    cuit: string | null;
    legalName: string | null;
    fiscalCondition: FiscalCustomerCondition | null;
    pointOfSale: number | null;
  };
  receiver: {
    name: string;
    fiscalCondition: FiscalCustomerCondition | null;
    docType: FiscalDocumentIdentityType;
    docTypeCode: number;
    docNumber: string | null;
    docNumberForRequest: string;
    condicionIVAReceptorId?: number;
  };
  header: {
    cantReg: 1;
    ptoVta: number | null;
    cbteTipo: number | null;
    cbteTipoLabel: string;
  };
  detail: {
    concepto: 1;
    conceptoLabel: "Productos";
    docTipo: number;
    docNro: string;
    cbteDesde: null;
    cbteHasta: null;
    cbteFch: string;
    impTotal: string;
    impTotConc: string;
    impNeto: string;
    impOpEx: string;
    impIVA: string;
    impTrib: "0.00";
    monId: typeof DEFAULT_CURRENCY;
    monCotiz: typeof DEFAULT_CURRENCY_RATE;
    iva: Array<{
      id: number | null;
      description: string;
      baseImp: string;
      importe: string;
    }>;
    condicionIVAReceptorId?: number;
  };
  document: {
    type: FiscalDocumentType;
    letter: FiscalDocumentLetter;
    typeLabel: string;
    letterLabel: string;
    letterReason: string;
    status: FiscalDocumentStatus;
  };
  taxSummary: {
    treatments: string[];
    vatGroups: Array<{
      id: number;
      description: string;
      baseImp: string;
      importe: string;
    }>;
  };
  items: Array<{
    description: string;
    quantity: string;
    unitType: UnitType | null;
    unitPrice: string;
    subtotal: string;
    netAmount: string;
    vatAmount: string;
    taxTreatment: FiscalTaxTreatment;
    taxTreatmentLabel: string;
    taxTreatmentSource: "PRODUCT" | "GLOBAL" | "MONOTRIBUTO_FACTURA_C";
    vatRate: string | null;
    taxCode: string | null;
  }>;
  notes: string[];
};

type ArcaPreEmissionSale = {
  id: string;
  saleNumber: number;
  total: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  status: SaleStatus;
  requiresFiscalInvoice: boolean;
  fiscalStatus: FiscalStatus;
  createdAt: Date;
  customer: {
    name: string;
    businessName: string | null;
    fiscalCondition: FiscalCustomerCondition | null;
    docType: FiscalDocumentIdentityType | null;
    docNumber: string | null;
    document: string | null;
  } | null;
  fiscalCustomerNameSnapshot: string | null;
  fiscalCustomerDocType: FiscalDocumentIdentityType | null;
  fiscalCustomerDocNumber: string | null;
  fiscalCustomerCondition: FiscalCustomerCondition | null;
};

type ArcaPreparedFiscalDocument = {
  id: string;
  type: FiscalDocumentType;
  letter: FiscalDocumentLetter;
  status: FiscalDocumentStatus;
  environment: FiscalEnvironment;
  pointOfSale: number | null;
  total: Prisma.Decimal;
  netAmount: Prisma.Decimal | null;
  vatAmount: Prisma.Decimal | null;
  exemptAmount: Prisma.Decimal | null;
  nonTaxedAmount: Prisma.Decimal | null;
  customerName: string | null;
  customerDocType: FiscalDocumentIdentityType | null;
  customerDocNumber: string | null;
  customerCondition: FiscalCustomerCondition | null;
  items: Array<{
    id: string;
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    vatRate: Prisma.Decimal | null;
    taxCode: string | null;
    taxTreatment: FiscalTaxTreatment | null;
  }>;
};

export type ArcaPreEmissionInput = {
  sale: ArcaPreEmissionSale | null;
  fiscalDocument: ArcaPreparedFiscalDocument | null;
  setting: FiscalSettingView;
  requireConnectionCredentials?: boolean;
  businessId?: string;
};

export function validateArcaPreEmission(
  input: ArcaPreEmissionInput
): ArcaPreEmissionValidation {
  const { sale, fiscalDocument, setting } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!setting.enabled) {
    errors.push("El modulo fiscal esta deshabilitado.");
  }

  if (setting.environment !== FiscalEnvironment.HOMOLOGACION) {
    errors.push("Esta etapa solo permite pre-emision ARCA en homologacion.");
  }

  if (!setting.cuit) {
    errors.push("Falta CUIT emisor en configuracion fiscal.");
  }

  if (!setting.pointOfSale) {
    errors.push("Falta punto de venta en configuracion fiscal.");
  }

  if (!setting.fiscalCondition) {
    errors.push("Falta condicion fiscal del comercio.");
  }

  if (input.requireConnectionCredentials) {
    if (!setting.hasArcaCertificatePem) {
      errors.push("Falta certificado ARCA para validar conexion real.");
    }
    if (!setting.hasArcaPrivateKeyPem) {
      errors.push("Falta clave privada ARCA para validar conexion real.");
    }
  }

  if (!sale) {
    errors.push("Venta no encontrada.");
    return { errors, warnings };
  }

  if (sale.status === SaleStatus.CANCELLED) {
    errors.push("La venta esta cancelada.");
  }

  if (!sale.requiresFiscalInvoice) {
    errors.push("La venta no requiere factura fiscal.");
  }

  if (!fiscalDocument) {
    errors.push("La venta no tiene FiscalDocument preparado.");
    return { errors, warnings };
  }

  if (fiscalDocument.status === FiscalDocumentStatus.ISSUED) {
    errors.push("El FiscalDocument ya fue emitido.");
  }

  if (fiscalDocument.items.length === 0) {
    errors.push("El FiscalDocument no tiene items.");
  }

  if (decimalLte(fiscalDocument.total, 0)) {
    errors.push("El total del comprobante es invalido o menor/igual a cero.");
  }

  if (!fiscalDocument.type) {
    errors.push("Falta tipo de comprobante.");
  }

  if (!fiscalDocument.letter) {
    errors.push("Falta letra del comprobante.");
  }

  if (mapVoucherType(fiscalDocument.type, fiscalDocument.letter).code === null) {
    errors.push("Tipo y letra de comprobante sin mapeo ARCA inicial.");
  }

  const receiver = resolveReceiver(input);
  if (
    receiver.condition === FiscalCustomerCondition.CONSUMIDOR_FINAL &&
    !receiver.docNumber
  ) {
    warnings.push("Receptor consumidor final sin documento.");
  }

  if (fiscalDocument.letter === FiscalDocumentLetter.A) {
    if (receiver.condition !== FiscalCustomerCondition.RESPONSABLE_INSCRIPTO) {
      errors.push("Factura A requiere receptor Responsable Inscripto.");
    }
    if (receiver.docType !== FiscalDocumentIdentityType.CUIT || !isValidCuit(receiver.docNumber)) {
      errors.push("Factura A requiere CUIT valido del receptor.");
    }
  }

  const expectedLetter = expectedLetterForFiscalCondition(setting, receiver.condition);
  if (expectedLetter && fiscalDocument.letter !== expectedLetter.letter) {
    errors.push(
      `La letra preparada (${fiscalDocument.letter}) no coincide con la condicion fiscal: deberia ser ${expectedLetter.letter}.`
    );
  }

  const fiscalAmounts = calculatePreparedFiscalAmounts(fiscalDocument, setting);
  errors.push(...fiscalAmounts.errors);
  warnings.push(...fiscalAmounts.warnings);

  if (!money(fiscalDocument.total).equals(fiscalAmounts.totals.impTotal)) {
    errors.push(
      `El total preparado (${decimalToMoneyString(
        fiscalDocument.total
      )}) no coincide con la suma de items (${decimalToMoneyString(
        fiscalAmounts.totals.impTotal
      )}).`
    );
  }

  if (!setting.arcaLastWsfeTestAt) {
    warnings.push("Punto de venta no probado con ultimo comprobante o consulta WSFEv1.");
  }

  if (!setting.arcaTokenExpiresAt || !setting.arcaTokenIsValid) {
    warnings.push("Token WSAA vencido o no disponible.");
  } else if (setting.arcaTokenExpiresAt.getTime() <= Date.now() + TOKEN_WARNING_WINDOW_MS) {
    warnings.push("Token WSAA proximo a vencer.");
  }

  if (!setting.legalName || !setting.fiscalCondition) {
    warnings.push("Datos del comercio incompletos.");
  }

  return { errors, warnings };
}

export function buildArcaInvoiceRequest(
  input: ArcaPreEmissionInput
): ArcaInvoiceRequestPreview {
  if (!input.sale) {
    throw new Error("No se puede armar request ARCA sin venta.");
  }

  if (!input.fiscalDocument) {
    throw new Error("No se puede armar request ARCA sin FiscalDocument.");
  }

  const { sale, fiscalDocument, setting } = input;
  const receiver = resolveReceiver(input);
  const docTypeCode = mapDocumentTypeCode(receiver.docType);
  const comprobante = mapVoucherType(fiscalDocument.type, fiscalDocument.letter);
  const fiscalAmounts = calculatePreparedFiscalAmounts(fiscalDocument, setting);
  const fiscalAmountItemsById = new Map(
    fiscalAmounts.items.map((item) => [item.id, item])
  );
  const letterReason = resolveLetterReason(setting, receiver.condition, fiscalDocument.letter);

  return {
    meta: {
      preparedOnly: true,
      environment: setting.environment,
      service: ARCA_SERVICE,
      futureOperation: FUTURE_OPERATION,
      generatedAt: new Date().toISOString(),
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      fiscalDocumentId: fiscalDocument.id
    },
    issuer: {
      cuit: setting.cuit,
      legalName: setting.legalName,
      fiscalCondition: setting.fiscalCondition,
      pointOfSale: setting.pointOfSale
    },
    receiver: {
      name: receiver.name,
      fiscalCondition: receiver.condition,
      docType: receiver.docType,
      docTypeCode,
      docNumber: receiver.docNumber,
      docNumberForRequest: receiver.docNumber ?? "0",
      condicionIVAReceptorId: resolveReceiverVatConditionId(receiver.condition, fiscalDocument.letter)
    },
    header: {
      cantReg: 1,
      ptoVta: setting.pointOfSale,
      cbteTipo: comprobante.code,
      cbteTipoLabel: comprobante.label
    },
    detail: {
      concepto: 1,
      conceptoLabel: "Productos",
      docTipo: docTypeCode,
      docNro: receiver.docNumber ?? "0",
      cbteDesde: null,
      cbteHasta: null,
      cbteFch: formatArcaVoucherDate(sale.createdAt),
      impTotal: decimalToMoneyString(fiscalAmounts.totals.impTotal),
      impTotConc: decimalToMoneyString(fiscalAmounts.totals.impTotConc),
      impNeto: decimalToMoneyString(fiscalAmounts.totals.impNeto),
      impOpEx: decimalToMoneyString(fiscalAmounts.totals.impOpEx),
      impIVA: decimalToMoneyString(fiscalAmounts.totals.impIVA),
      impTrib: "0.00",
      monId: DEFAULT_CURRENCY,
      monCotiz: DEFAULT_CURRENCY_RATE,
      iva: fiscalAmounts.vatGroups.map((group) => ({
        id: group.vatArcaCode,
        description: `IVA ${group.vatRate.toFixed(2)}%`,
        baseImp: decimalToMoneyString(group.baseImp),
        importe: decimalToMoneyString(group.importe)
      })),
      condicionIVAReceptorId: resolveReceiverVatConditionId(receiver.condition, fiscalDocument.letter)
    },
    document: {
      type: fiscalDocument.type,
      letter: fiscalDocument.letter,
      typeLabel: fiscalDocument.type === FiscalDocumentType.INVOICE ? "Factura" : fiscalDocument.type,
      letterLabel: fiscalDocument.letter,
      letterReason,
      status: fiscalDocument.status
    },
    taxSummary: {
      treatments: buildTaxTreatmentSummary(fiscalAmounts.items),
      vatGroups: fiscalAmounts.vatGroups.map((group) => ({
        id: group.vatArcaCode,
        description: `IVA ${group.vatRate.toFixed(2)}%`,
        baseImp: decimalToMoneyString(group.baseImp),
        importe: decimalToMoneyString(group.importe)
      }))
    },
    items: fiscalDocument.items.map((item) => {
      const fiscalAmountItem = fiscalAmountItemsById.get(item.id);
      const taxTreatment = fiscalAmountItem?.taxTreatment ?? FiscalTaxTreatment.TAXED;
      const vatArcaCode = fiscalAmountItem?.vatArcaCode ?? parseTaxCode(item.taxCode);

      return {
        description: item.description,
        quantity: item.quantity.toFixed(3),
        unitType: null,
        unitPrice: decimalToMoneyString(item.unitPrice),
        subtotal: decimalToMoneyString(item.subtotal),
        netAmount: decimalToMoneyString(fiscalAmountItem?.netAmount ?? item.subtotal),
        vatAmount: decimalToMoneyString(
          fiscalAmountItem?.vatAmount ?? new Prisma.Decimal(0)
        ),
        taxTreatment,
        taxTreatmentLabel: fiscalTaxTreatmentLabel(taxTreatment),
        taxTreatmentSource: fiscalAmountItem?.taxTreatmentSource ?? "GLOBAL",
        vatRate: fiscalAmountItem?.vatRate?.toFixed(2) ?? item.vatRate?.toFixed(2) ?? null,
        taxCode: vatArcaCode === null ? item.taxCode : String(vatArcaCode)
      };
    }),
    notes: [
      "Preview interno. No enviado a ARCA.",
      "CbteDesde/CbteHasta se mantienen null para no asignar numero fiscal real.",
      "Auth Token/Sign no se incluyen en esta previsualizacion."
    ]
  };
}

function resolveReceiver(input: ArcaPreEmissionInput) {
  const { sale, fiscalDocument, setting } = input;
  const docType =
    fiscalDocument?.customerDocType ??
    sale?.fiscalCustomerDocType ??
    sale?.customer?.docType ??
    setting.defaultCustomerDocType;
  const docNumber =
    fiscalDocument?.customerDocNumber ??
    sale?.fiscalCustomerDocNumber ??
    sale?.customer?.docNumber ??
    sale?.customer?.document ??
    null;

  return {
    name:
      fiscalDocument?.customerName ??
      sale?.fiscalCustomerNameSnapshot ??
      sale?.customer?.businessName ??
      sale?.customer?.name ??
      "Consumidor final",
    condition:
      fiscalDocument?.customerCondition ??
      sale?.fiscalCustomerCondition ??
      sale?.customer?.fiscalCondition ??
      FiscalCustomerCondition.CONSUMIDOR_FINAL,
    docType,
    docNumber: cleanDocumentNumber(docNumber)
  };
}

export function mapVoucherType(type: FiscalDocumentType, letter: FiscalDocumentLetter) {
  const codeMap: Record<FiscalDocumentType, Record<FiscalDocumentLetter, number | null>> = {
    INVOICE: { A: 1, B: 6, C: 11, M: null, E: null },
    DEBIT_NOTE: { A: 2, B: 7, C: 12, M: null, E: null },
    CREDIT_NOTE: { A: 3, B: 8, C: 13, M: null, E: null }
  };
  const labelMap: Record<FiscalDocumentType, string> = {
    INVOICE: "Factura",
    DEBIT_NOTE: "Nota de debito",
    CREDIT_NOTE: "Nota de credito"
  };
  const code = codeMap[type][letter];

  return {
    code,
    label: `${labelMap[type]} ${letter}`
  };
}

export function mapDocumentTypeCode(type: FiscalDocumentIdentityType) {
  const codeMap: Record<FiscalDocumentIdentityType, number> = {
    CUIT: 80,
    CUIL: 86,
    CDI: 87,
    DNI: 96,
    PASAPORTE: 94,
    CONSUMIDOR_FINAL: 99,
    OTHER: 99
  };

  return codeMap[type];
}

function calculatePreparedFiscalAmounts(
  fiscalDocument: ArcaPreparedFiscalDocument,
  setting: FiscalSettingView
) {
  return calculateFiscalAmountsForSale({
    items: fiscalDocument.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      product: {
        taxTreatment: item.taxTreatment,
        vatRate: item.vatRate,
        vatArcaCode: parseTaxCode(item.taxCode)
      }
    })),
    setting,
    documentLetter: fiscalDocument.letter
  });
}

function expectedLetterForFiscalCondition(
  setting: FiscalSettingView,
  receiverCondition: FiscalCustomerCondition | null
) {
  if (setting.fiscalCondition === FiscalCustomerCondition.MONOTRIBUTO) {
    return { letter: FiscalDocumentLetter.C };
  }

  if (setting.fiscalCondition === FiscalCustomerCondition.RESPONSABLE_INSCRIPTO) {
    return {
      letter:
        receiverCondition === FiscalCustomerCondition.RESPONSABLE_INSCRIPTO
          ? FiscalDocumentLetter.A
          : FiscalDocumentLetter.B
    };
  }

  if (setting.defaultInvoiceLetter) {
    return { letter: setting.defaultInvoiceLetter };
  }

  return null;
}

function resolveLetterReason(
  setting: FiscalSettingView,
  receiverCondition: FiscalCustomerCondition | null,
  letter: FiscalDocumentLetter
) {
  if (setting.fiscalCondition === FiscalCustomerCondition.MONOTRIBUTO) {
    return "Emisor monotributo: corresponde Factura C.";
  }

  if (setting.fiscalCondition === FiscalCustomerCondition.RESPONSABLE_INSCRIPTO) {
    return receiverCondition === FiscalCustomerCondition.RESPONSABLE_INSCRIPTO
      ? "Emisor y receptor responsables inscriptos: corresponde Factura A."
      : "Emisor responsable inscripto con receptor consumidor final/monotributo/exento: corresponde Factura B.";
  }

  return `Letra ${letter} tomada de la configuracion fiscal por defecto.`;
}

function buildTaxTreatmentSummary(
  items: Array<{ taxTreatment: FiscalTaxTreatment; vatRate: Prisma.Decimal | null }>
) {
  return [
    ...new Set(
      items.map((item) =>
        item.vatRate
          ? `${fiscalTaxTreatmentLabel(item.taxTreatment)} ${item.vatRate.toFixed(2)}%`
          : fiscalTaxTreatmentLabel(item.taxTreatment)
      )
    )
  ];
}

function parseTaxCode(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanDocumentNumber(value: string | null) {
  const cleaned = value?.replace(/\D/g, "") ?? "";
  return cleaned || null;
}

function isValidCuit(value: string | null) {
  return Boolean(value && /^\d{11}$/.test(value));
}

function decimalLte(value: Prisma.Decimal | null, compareTo: number) {
  if (!value) {
    return true;
  }

  return value.lessThanOrEqualTo(compareTo);
}

function decimalToMoneyString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

export function formatArcaVoucherDate(value: Date) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const partMap = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${partMap.year}${partMap.month}${partMap.day}`;
}
