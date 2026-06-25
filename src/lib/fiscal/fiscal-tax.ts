import { FiscalTaxTreatment, Prisma } from "@prisma/client";

export type FiscalTaxOptionValue =
  | "INHERIT"
  | "TAXED_21"
  | "TAXED_10_5"
  | "TAXED_27"
  | "TAXED_0"
  | "EXEMPT"
  | "NON_TAXABLE";

export type FiscalTaxSelection = {
  treatment: FiscalTaxTreatment | null;
  vatRate: Prisma.Decimal | null;
  vatArcaCode: number | null;
};

export const fiscalTaxOptions: Array<{
  value: FiscalTaxOptionValue;
  label: string;
  help: string;
  selection: FiscalTaxSelection;
}> = [
  {
    value: "INHERIT",
    label: "Heredar configuracion fiscal",
    help: "Usa el IVA por defecto de configuracion fiscal.",
    selection: { treatment: null, vatRate: null, vatArcaCode: null }
  },
  {
    value: "TAXED_21",
    label: "Gravado 21%",
    help: "Codigo ARCA 5.",
    selection: {
      treatment: FiscalTaxTreatment.TAXED,
      vatRate: new Prisma.Decimal(21),
      vatArcaCode: 5
    }
  },
  {
    value: "TAXED_10_5",
    label: "Gravado 10.5%",
    help: "Codigo ARCA 4.",
    selection: {
      treatment: FiscalTaxTreatment.TAXED,
      vatRate: new Prisma.Decimal(10.5),
      vatArcaCode: 4
    }
  },
  {
    value: "TAXED_27",
    label: "Gravado 27%",
    help: "Codigo ARCA 6.",
    selection: {
      treatment: FiscalTaxTreatment.TAXED,
      vatRate: new Prisma.Decimal(27),
      vatArcaCode: 6
    }
  },
  {
    value: "TAXED_0",
    label: "Gravado 0%",
    help: "Codigo ARCA 3.",
    selection: {
      treatment: FiscalTaxTreatment.TAXED,
      vatRate: new Prisma.Decimal(0),
      vatArcaCode: 3
    }
  },
  {
    value: "EXEMPT",
    label: "Exento",
    help: "Suma en importe exento.",
    selection: {
      treatment: FiscalTaxTreatment.EXEMPT,
      vatRate: new Prisma.Decimal(0),
      vatArcaCode: null
    }
  },
  {
    value: "NON_TAXABLE",
    label: "No gravado",
    help: "Suma en importe no gravado.",
    selection: {
      treatment: FiscalTaxTreatment.NON_TAXABLE,
      vatRate: new Prisma.Decimal(0),
      vatArcaCode: null
    }
  }
];

export function taxSelectionFromOption(value: string): FiscalTaxSelection | null {
  return fiscalTaxOptions.find((option) => option.value === value)?.selection ?? null;
}

export function optionFromTaxSelection(input: FiscalTaxSelection): FiscalTaxOptionValue {
  if (!input.treatment) {
    return "INHERIT";
  }

  if (input.treatment === FiscalTaxTreatment.EXEMPT) {
    return "EXEMPT";
  }

  if (input.treatment === FiscalTaxTreatment.NON_TAXABLE) {
    return "NON_TAXABLE";
  }

  const rate = input.vatRate?.toString();
  if (rate === "10.5") {
    return "TAXED_10_5";
  }
  if (rate === "27") {
    return "TAXED_27";
  }
  if (rate === "0") {
    return "TAXED_0";
  }

  return "TAXED_21";
}

export function vatArcaCodeFromRate(rate: Prisma.Decimal | null) {
  if (!rate) {
    return null;
  }

  if (rate.equals(21)) {
    return 5;
  }
  if (rate.equals(10.5)) {
    return 4;
  }
  if (rate.equals(27)) {
    return 6;
  }
  if (rate.equals(0)) {
    return 3;
  }

  return null;
}

export function fiscalTaxTreatmentLabel(value: FiscalTaxTreatment | null) {
  if (value === FiscalTaxTreatment.TAXED) {
    return "Gravado";
  }
  if (value === FiscalTaxTreatment.EXEMPT) {
    return "Exento";
  }
  if (value === FiscalTaxTreatment.NON_TAXABLE) {
    return "No gravado";
  }

  return "Sin definir";
}
