import * as XLSX from "xlsx";
import { PRODUCT_IMPORT_COLUMNS } from "@/lib/excel/products-import";

export type ExportableProduct = {
  name: string;
  barcode: string | null;
  sku: string | null;
  category: {
    name: string;
  };
  brand: string | null;
  salePrice: { toString(): string };
  cost: { toString(): string } | null;
  stock: { toString(): string };
  minStock: { toString(): string };
  unitType: string;
  active: boolean;
  quickAccess: boolean;
};

export function buildProductsExportWorkbook(products: ExportableProduct[]) {
  const rows = products.map(productToExportRow);

  return buildWorkbook(rows, "productos");
}

export function buildProductsTemplateWorkbook() {
  return buildWorkbook(
    [
      {
        nombre: "Yerba ejemplo 1kg",
        codigo_barras: "7790000000012",
        sku: "YERBA-1KG",
        categoria: "Almacen",
        marca: "Marca ejemplo",
        precio_venta: "2500",
        costo: "1800",
        stock: "10",
        stock_minimo: "2",
        unidad: "UNIT",
        activo: "SI",
        acceso_rapido: "X"
      }
    ],
    "plantilla"
  );
}

export function writeProductsExportBuffer(products: ExportableProduct[]) {
  return writeWorkbookBuffer(buildProductsExportWorkbook(products));
}

export function writeProductsTemplateBuffer() {
  return writeWorkbookBuffer(buildProductsTemplateWorkbook());
}

function productToExportRow(product: ExportableProduct) {
  return {
    nombre: product.name,
    codigo_barras: product.barcode ?? "",
    sku: product.sku ?? "",
    categoria: product.category.name,
    marca: product.brand ?? "",
    precio_venta: product.salePrice.toString(),
    costo: product.cost?.toString() ?? "",
    stock: product.stock.toString(),
    stock_minimo: product.minStock.toString(),
    unidad: product.unitType,
    activo: product.active ? "SI" : "NO",
    acceso_rapido: product.quickAccess ? "X" : ""
  };
}

function buildWorkbook(rows: Array<Record<string, string>>, sheetName: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...PRODUCT_IMPORT_COLUMNS]
  });

  worksheet["!cols"] = PRODUCT_IMPORT_COLUMNS.map((column) => ({
    wch: Math.max(column.length + 2, 16)
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return workbook;
}

function writeWorkbookBuffer(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  }) as Buffer;
}
