import {
  FiscalDocumentLetter,
  FiscalTaxTreatment,
  Prisma,
  type UnitType
} from "@prisma/client";
import { vatArcaCodeFromRate } from "@/lib/fiscal/fiscal-tax";

type FiscalAmountSetting = {
  defaultTaxTreatment: FiscalTaxTreatment | null;
  defaultVatRate: Prisma.Decimal | string | null;
  defaultVatArcaCode: number | null;
};

type FiscalAmountItem = {
  id: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  unitType?: UnitType | null;
  product?: {
    taxTreatment: FiscalTaxTreatment | null;
    vatRate: Prisma.Decimal | null;
    vatArcaCode: number | null;
  } | null;
};

export type FiscalAmountItemResult = {
  id: string;
  description: string;
  quantity: Prisma.Decimal;
  unitType: UnitType | null;
  unitPrice: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  taxTreatment: FiscalTaxTreatment;
  taxTreatmentSource: "PRODUCT" | "GLOBAL" | "MONOTRIBUTO_FACTURA_C";
  vatRate: Prisma.Decimal | null;
  vatArcaCode: number | null;
  netAmount: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  exemptAmount: Prisma.Decimal;
  nonTaxedAmount: Prisma.Decimal;
};

export type FiscalVatGroup = {
  vatArcaCode: number;
  vatRate: Prisma.Decimal;
  baseImp: Prisma.Decimal;
  importe: Prisma.Decimal;
};

export type FiscalAmountCalculation = {
  items: FiscalAmountItemResult[];
  vatGroups: FiscalVatGroup[];
  totals: {
    impTotal: Prisma.Decimal;
    impNeto: Prisma.Decimal;
    impIVA: Prisma.Decimal;
    impOpEx: Prisma.Decimal;
    impTotConc: Prisma.Decimal;
    impTrib: Prisma.Decimal;
  };
  errors: string[];
  warnings: string[];
};

const ZERO = new Prisma.Decimal(0);

export function calculateFiscalAmountsForSale(input: {
  items: FiscalAmountItem[];
  setting: FiscalAmountSetting;
  documentLetter: FiscalDocumentLetter;
}): FiscalAmountCalculation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const calculatedItems = input.items.map((item) =>
    calculateFiscalAmountsForItem({
      item,
      setting: input.setting,
      documentLetter: input.documentLetter,
      errors,
      warnings
    })
  );
  const vatGroups = groupVat(calculatedItems);
  const totals = calculatedItems.reduce(
    (acc, item) => ({
      impTotal: money(acc.impTotal.plus(item.grossAmount)),
      impNeto: money(acc.impNeto.plus(item.netAmount)),
      impIVA: money(acc.impIVA.plus(item.vatAmount)),
      impOpEx: money(acc.impOpEx.plus(item.exemptAmount)),
      impTotConc: money(acc.impTotConc.plus(item.nonTaxedAmount)),
      impTrib: ZERO
    }),
    {
      impTotal: ZERO,
      impNeto: ZERO,
      impIVA: ZERO,
      impOpEx: ZERO,
      impTotConc: ZERO,
      impTrib: ZERO
    }
  );
  const componentTotal = money(
    totals.impNeto
      .plus(totals.impIVA)
      .plus(totals.impOpEx)
      .plus(totals.impTotConc)
      .plus(totals.impTrib)
  );

  if (!componentTotal.equals(totals.impTotal)) {
    errors.push(
      `Sumatoria fiscal inconsistente: total ${totals.impTotal.toFixed(2)} vs componentes ${componentTotal.toFixed(2)}.`
    );
  }

  return {
    items: calculatedItems,
    vatGroups,
    totals,
    errors,
    warnings
  };
}

function calculateFiscalAmountsForItem(input: {
  item: FiscalAmountItem;
  setting: FiscalAmountSetting;
  documentLetter: FiscalDocumentLetter;
  errors: string[];
  warnings: string[];
}): FiscalAmountItemResult {
  const { item, setting, documentLetter, errors, warnings } = input;
  const grossAmount = money(item.subtotal);

  if (documentLetter === FiscalDocumentLetter.C) {
    return {
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitType: item.unitType ?? null,
      unitPrice: money(item.unitPrice),
      grossAmount,
      taxTreatment: FiscalTaxTreatment.TAXED,
      taxTreatmentSource: "MONOTRIBUTO_FACTURA_C",
      vatRate: null,
      vatArcaCode: null,
      netAmount: grossAmount,
      vatAmount: ZERO,
      exemptAmount: ZERO,
      nonTaxedAmount: ZERO
    };
  }

  const taxTreatment = item.product?.taxTreatment ?? setting.defaultTaxTreatment;
  const taxTreatmentSource = item.product?.taxTreatment ? "PRODUCT" : "GLOBAL";

  if (!taxTreatment) {
    errors.push(`No se puede determinar IVA/tratamiento fiscal para "${item.description}".`);
    return emptyItemResult(item, grossAmount);
  }

  if (!item.product?.taxTreatment) {
    warnings.push(`"${item.description}" no tiene IVA propio; usa IVA global.`);
  }

  if (taxTreatment === FiscalTaxTreatment.EXEMPT) {
    return {
      ...baseItemResult(item, grossAmount, taxTreatment, taxTreatmentSource),
      vatRate: new Prisma.Decimal(0),
      vatArcaCode: null,
      netAmount: ZERO,
      vatAmount: ZERO,
      exemptAmount: grossAmount,
      nonTaxedAmount: ZERO
    };
  }

  if (taxTreatment === FiscalTaxTreatment.NON_TAXABLE) {
    return {
      ...baseItemResult(item, grossAmount, taxTreatment, taxTreatmentSource),
      vatRate: new Prisma.Decimal(0),
      vatArcaCode: null,
      netAmount: ZERO,
      vatAmount: ZERO,
      exemptAmount: ZERO,
      nonTaxedAmount: grossAmount
    };
  }

  const vatRate = toDecimalOrNull(item.product?.vatRate ?? setting.defaultVatRate);
  const vatArcaCode =
    item.product?.vatArcaCode ?? setting.defaultVatArcaCode ?? vatArcaCodeFromRate(vatRate);

  if (!vatRate) {
    errors.push(`Falta alicuota IVA para "${item.description}".`);
    return emptyItemResult(item, grossAmount);
  }

  if (vatArcaCode === null) {
    errors.push(`Falta codigo ARCA de IVA para "${item.description}".`);
    return emptyItemResult(item, grossAmount);
  }

  const divisor = new Prisma.Decimal(1).plus(vatRate.div(100));
  const netAmount = vatRate.equals(0) ? grossAmount : money(grossAmount.div(divisor));
  const vatAmount = money(grossAmount.minus(netAmount));

  return {
    ...baseItemResult(item, grossAmount, taxTreatment, taxTreatmentSource),
    vatRate,
    vatArcaCode,
    netAmount,
    vatAmount,
    exemptAmount: ZERO,
    nonTaxedAmount: ZERO
  };
}

function baseItemResult(
  item: FiscalAmountItem,
  grossAmount: Prisma.Decimal,
  taxTreatment: FiscalTaxTreatment,
  taxTreatmentSource: "PRODUCT" | "GLOBAL"
) {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitType: item.unitType ?? null,
    unitPrice: money(item.unitPrice),
    grossAmount,
    taxTreatment,
    taxTreatmentSource
  };
}

function emptyItemResult(
  item: FiscalAmountItem,
  grossAmount: Prisma.Decimal
): FiscalAmountItemResult {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitType: item.unitType ?? null,
    unitPrice: money(item.unitPrice),
    grossAmount,
    taxTreatment: FiscalTaxTreatment.TAXED,
    taxTreatmentSource: "GLOBAL",
    vatRate: null,
    vatArcaCode: null,
    netAmount: grossAmount,
    vatAmount: ZERO,
    exemptAmount: ZERO,
    nonTaxedAmount: ZERO
  };
}

function groupVat(items: FiscalAmountItemResult[]) {
  const groups = new Map<string, FiscalVatGroup>();

  for (const item of items) {
    if (
      item.taxTreatment !== FiscalTaxTreatment.TAXED ||
      !item.vatRate ||
      item.vatArcaCode === null
    ) {
      continue;
    }

    const key = String(item.vatArcaCode);
    const current = groups.get(key);
    if (current) {
      current.baseImp = money(current.baseImp.plus(item.netAmount));
      current.importe = money(current.importe.plus(item.vatAmount));
      continue;
    }

    groups.set(key, {
      vatArcaCode: item.vatArcaCode,
      vatRate: item.vatRate,
      baseImp: item.netAmount,
      importe: item.vatAmount
    });
  }

  return [...groups.values()].filter(
    (group) => !group.baseImp.equals(0) || !group.importe.equals(0)
  );
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

function toDecimalOrNull(value: Prisma.Decimal | string | null) {
  return value === null ? null : new Prisma.Decimal(value);
}
