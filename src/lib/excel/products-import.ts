import { UnitType } from "@prisma/client";
import * as XLSX from "xlsx";
import { parseLocalizedDecimal } from "@/lib/money";
import { shouldUseDecimalQuantity } from "@/lib/stock-format";

export const PRODUCT_IMPORT_COLUMNS = [
  "nombre",
  "codigo_barras",
  "sku",
  "categoria",
  "marca",
  "precio_venta",
  "costo",
  "stock",
  "stock_minimo",
  "unidad",
  "activo",
  "acceso_rapido"
] as const;

export type ProductImportRow = {
  rowNumber: number;
  name: string;
  barcode: string | null;
  sku: string | null;
  category: string;
  brand: string | null;
  salePrice: string | null;
  cost: string | null;
  stock: string | null;
  minStock: string | null;
  unitType: UnitType;
  unitTypeProvided: boolean;
  allowsDecimalQuantity: boolean;
  active: boolean | null;
  quickAccess: boolean | null;
  errors: string[];
};

export type ExistingProductForImport = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
};

export type ProductImportPreviewRow = ProductImportRow & {
  action: "create" | "update" | "error";
  productId: string | null;
  productName: string | null;
  categoryWillBeCreated: boolean;
};

export type ProductImportPreview = {
  rows: ProductImportPreviewRow[];
  rowsJson: string;
  summary: {
    createCount: number;
    updateCount: number;
    errorCount: number;
    validCount: number;
    newCategories: string[];
  };
};

const UNIT_ALIASES: Record<string, UnitType> = {
  unidad: UnitType.UNIT,
  unidades: UnitType.UNIT,
  unit: UnitType.UNIT,
  u: UnitType.UNIT,
  kg: UnitType.KG,
  kilo: UnitType.KG,
  kilos: UnitType.KG,
  gr: UnitType.GR,
  gramo: UnitType.GR,
  gramos: UnitType.GR,
  litro: UnitType.LITER,
  litros: UnitType.LITER,
  liter: UnitType.LITER,
  meter: UnitType.METER,
  metro: UnitType.METER,
  metros: UnitType.METER,
  pack: UnitType.PACK,
  caja: UnitType.BOX,
  box: UnitType.BOX,
  otro: UnitType.OTHER
};

export function parseProductsImportWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("El archivo no tiene hojas.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: "",
    raw: false
  });

  const normalizedRows = rows
    .map((row, index) => normalizeRow(row, index + 2))
    .filter((row) => hasImportData(row));

  markDuplicateErrors(normalizedRows, "barcode", "Codigo de barras duplicado en el archivo.");
  markDuplicateErrors(normalizedRows, "sku", "SKU duplicado en el archivo.");

  return normalizedRows;
}

export function buildProductsImportPreview(
  rows: ProductImportRow[],
  existingProducts: ExistingProductForImport[],
  existingCategoryNames: string[]
): ProductImportPreview {
  const productsByBarcode = new Map(
    existingProducts
      .filter((product) => product.barcode)
      .map((product) => [identity(product.barcode), product])
  );
  const productsBySku = new Map(
    existingProducts
      .filter((product) => product.sku)
      .map((product) => [identity(product.sku), product])
  );
  const categories = new Set(existingCategoryNames.map(normalizeName));

  const previewRows: ProductImportPreviewRow[] = rows.map((row) => {
    const errors = [...row.errors];
    const matchedProduct = findMatchedProduct(row, productsByBarcode, productsBySku, errors);
    const isCreate = !matchedProduct;

    if (isCreate) {
      if (!row.name) {
        errors.push("Falta nombre.");
      }

      if (!row.category) {
        errors.push("Falta categoria.");
      }

      if (!row.salePrice) {
        errors.push("Falta precio.");
      }
    }

    const categoryWillBeCreated =
      Boolean(row.category) && !categories.has(normalizeName(row.category));
    const action = errors.length > 0 ? "error" : isCreate ? "create" : "update";

    return {
      ...row,
      action,
      productId: matchedProduct?.id ?? null,
      productName: matchedProduct?.name ?? null,
      categoryWillBeCreated,
      errors
    };
  });

  const newCategories = [
    ...new Set(
      previewRows
        .filter((row) => row.action !== "error" && row.categoryWillBeCreated)
        .map((row) => row.category)
    )
  ].sort((left, right) => left.localeCompare(right));

  const createCount = previewRows.filter((row) => row.action === "create").length;
  const updateCount = previewRows.filter((row) => row.action === "update").length;
  const errorCount = previewRows.filter((row) => row.action === "error").length;

  return {
    rows: previewRows,
    rowsJson: JSON.stringify(rows),
    summary: {
      createCount,
      updateCount,
      errorCount,
      validCount: createCount + updateCount,
      newCategories
    }
  };
}

function normalizeRow(row: Record<string, unknown>, rowNumber: number): ProductImportRow {
  const normalizedRow = normalizeKeys(row);
  const errors: string[] = [];
  const rawUnitType = readText(normalizedRow.unidad);
  const unitType = parseUnitType(rawUnitType, errors);

  return {
    rowNumber,
    name: readText(normalizedRow.nombre),
    barcode: readText(normalizedRow.codigo_barras) || null,
    sku: readText(normalizedRow.sku) || null,
    category: readText(normalizedRow.categoria),
    brand: readText(normalizedRow.marca) || null,
    salePrice: parseOptionalDecimal(normalizedRow.precio_venta, "Precio invalido.", errors),
    cost: parseOptionalDecimal(normalizedRow.costo, "Costo invalido.", errors),
    stock: parseOptionalDecimal(normalizedRow.stock, "Stock invalido.", errors),
    minStock: parseOptionalDecimal(
      normalizedRow.stock_minimo,
      "Stock minimo invalido.",
      errors
    ),
    unitType,
    unitTypeProvided: Boolean(rawUnitType),
    allowsDecimalQuantity: shouldUseDecimalQuantity(unitType),
    active: parseOptionalBoolean(normalizedRow.activo, "Activo invalido.", errors),
    quickAccess: parseOptionalBoolean(
      normalizedRow.acceso_rapido,
      "Acceso rapido invalido.",
      errors
    ),
    errors
  };
}

function findMatchedProduct(
  row: ProductImportRow,
  productsByBarcode: Map<string, ExistingProductForImport>,
  productsBySku: Map<string, ExistingProductForImport>,
  errors: string[]
) {
  const barcodeProduct = row.barcode ? productsByBarcode.get(identity(row.barcode)) : null;
  const skuProduct = row.sku ? productsBySku.get(identity(row.sku)) : null;

  if (barcodeProduct && skuProduct && barcodeProduct.id !== skuProduct.id) {
    errors.push("Codigo de barras y SKU corresponden a productos distintos.");
    return barcodeProduct;
  }

  if (barcodeProduct) {
    return barcodeProduct;
  }

  if (row.barcode && skuProduct) {
    errors.push("Codigo de barras nuevo pero SKU ya existe.");
    return skuProduct;
  }

  if (!row.barcode && skuProduct) {
    return skuProduct;
  }

  return null;
}

function normalizeKeys(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  ) as Record<string, unknown>;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseOptionalDecimal(value: unknown, error: string, errors: string[]) {
  const raw = readText(value);
  if (!raw) {
    return null;
  }

  try {
    const decimal = parseLocalizedDecimal(raw);
    if (decimal.lt(0)) {
      errors.push(error);
      return raw;
    }

    return decimal.toString();
  } catch {
    errors.push(error);
    return raw;
  }
}

function parseUnitType(value: string, errors: string[]) {
  if (!value) {
    return UnitType.UNIT;
  }

  const normalized = normalizeName(value).replace(/\s/g, "_");
  const unitType =
    UNIT_ALIASES[normalized] ?? UnitType[value.toUpperCase() as keyof typeof UnitType];

  if (!unitType) {
    errors.push("Unidad invalida.");
    return UnitType.OTHER;
  }

  return unitType;
}

function parseOptionalBoolean(value: unknown, error: string, errors: string[]) {
  const normalized = normalizeName(readText(value));
  if (!normalized) {
    return null;
  }

  if (["1", "si", "s", "true", "x", "yes", "activo", "activa"].includes(normalized)) {
    return true;
  }

  if (["0", "no", "false", "inactivo", "inactiva"].includes(normalized)) {
    return false;
  }

  errors.push(error);
  return null;
}

function markDuplicateErrors(
  rows: ProductImportRow[],
  field: "barcode" | "sku",
  error: string
) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = row[field];
    if (!value) {
      continue;
    }

    const key = identity(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const row of rows) {
    const value = row[field];
    if (value && (counts.get(identity(value)) ?? 0) > 1) {
      row.errors.push(error);
    }
  }
}

function hasImportData(row: ProductImportRow) {
  return Boolean(
    row.name ||
      row.barcode ||
      row.sku ||
      row.category ||
      row.brand ||
      row.salePrice ||
      row.cost ||
      row.stock ||
      row.minStock ||
      row.unitTypeProvided ||
      row.active !== null ||
      row.quickAccess !== null
  );
}

function readText(value: unknown) {
  return String(value ?? "").trim();
}

function identity(value: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
