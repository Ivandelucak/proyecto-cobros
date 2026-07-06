"use server";

import { Prisma, Role, StockMovementType, UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  buildProductsImportPreview,
  parseProductsImportWorkbook,
  type ProductImportPreview,
  type ProductImportPreviewRow,
  type ProductImportRow
} from "@/lib/excel/products-import";
import { prisma } from "@/lib/prisma";
import { shouldUseDecimalQuantity } from "@/lib/stock-format";

export type ImportProductsResult = {
  created: number;
  updated: number;
  skipped: number;
  stockMovements: number;
  categoriesCreated: number;
};

export type ImportProductsState = {
  error?: string;
  preview?: ProductImportPreview;
  result?: ImportProductsResult;
};

export async function previewProductsImportAction(
  _prevState: ImportProductsState,
  formData: FormData
): Promise<ImportProductsState> {
  const user = await requireAdminUser();

  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Subi un archivo Excel.");
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new Error("El archivo debe ser .xlsx.");
    }

    const rows = parseProductsImportWorkbook(Buffer.from(await file.arrayBuffer()));
    if (rows.length === 0) {
      throw new Error("El archivo no tiene productos para importar.");
    }

    return {
      preview: await buildPreview(rows, user.businessId!)
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function confirmProductsImportAction(
  _prevState: ImportProductsState,
  formData: FormData
): Promise<ImportProductsState> {
  const user = await requireAdminUser();

  try {
    const rows = parseRowsJson(String(formData.get("rowsJson") ?? ""));
    const preview = await buildPreview(rows, user.businessId!);
    const result = await importValidRows(preview.rows, user.id, user.businessId!);

    revalidatePath("/productos");
    revalidatePath("/productos/importar");
    revalidatePath("/caja");
    revalidatePath("/stock");

    return { result };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

async function buildPreview(rows: ProductImportRow[], businessId: string) {
  const barcodes = unique(rows.map((row) => row.barcode).filter(Boolean));
  const skus = unique(rows.map((row) => row.sku).filter(Boolean));
  const productFilters: Prisma.ProductWhereInput[] = [];

  if (barcodes.length > 0) {
    productFilters.push({ barcode: { in: barcodes } });
  }

  if (skus.length > 0) {
    productFilters.push({ sku: { in: skus } });
  }

  const [products, categories] = await Promise.all([
    productFilters.length > 0
      ? prisma.product.findMany({
          where: {
            businessId,
            deletedAt: null,
            OR: productFilters
          },
          select: {
            id: true,
            name: true,
            barcode: true,
            sku: true
          }
        })
      : Promise.resolve([]),
    prisma.category.findMany({
      where: { businessId },
      select: { name: true }
    })
  ]);

  return buildProductsImportPreview(
    rows,
    products,
    categories.map((category) => category.name)
  );
}

async function importValidRows(rows: ProductImportPreviewRow[], userId: string, businessId: string) {
  const validRows = rows.filter((row) => row.action !== "error");

  return prisma.$transaction(async (tx) => {
    const result: ImportProductsResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      stockMovements: 0,
      categoriesCreated: 0
    };
    const categories = await tx.category.findMany({
      where: { businessId },
      select: { id: true, name: true }
    });
    const categoriesByName = new Map(
      categories.map((category) => [normalizeName(category.name), category])
    );

    for (const categoryName of unique(validRows.map((row) => row.category).filter(Boolean))) {
      const key = normalizeName(categoryName);
      if (!categoriesByName.has(key)) {
        const category = await tx.category.create({
          data: {
            businessId,
            name: categoryName,
            active: true
          },
          select: {
            id: true,
            name: true
          }
        });
        categoriesByName.set(key, category);
        result.categoriesCreated += 1;
      }
    }

    for (const row of validRows) {
      const category = row.category ? categoriesByName.get(normalizeName(row.category)) : null;

      if (row.action === "create") {
        if (!row.name || !row.salePrice || !category) {
          result.skipped += 1;
          continue;
        }

        const stock = toDecimalOrZero(row.stock);
        const product = await tx.product.create({
          data: {
            businessId,
            name: row.name,
            barcode: row.barcode,
            sku: row.sku,
            brand: row.brand,
            categoryId: category.id,
            salePrice: toMoneyDecimal(row.salePrice),
            cost: row.cost ? toMoneyDecimal(row.cost) : null,
            stock,
            minStock: toDecimalOrZero(row.minStock),
            unitType: row.unitType,
            allowsDecimalQuantity: shouldUseDecimalQuantity(row.unitType),
            active: row.active ?? true,
            quickAccess: row.quickAccess ?? false
          }
        });

        result.created += 1;

        if (stock.gt(0)) {
          await tx.stockMovement.create({
            data: {
              businessId,
              productId: product.id,
              type: StockMovementType.INITIAL_IMPORT,
              quantity: stock,
              previousStock: new Prisma.Decimal(0),
              newStock: stock,
              reason: "Importacion Excel",
              userId
            }
          });
          result.stockMovements += 1;
        }

        continue;
      }

      if (!row.productId) {
        result.skipped += 1;
        continue;
      }

      const currentProduct = await tx.product.findUnique({
        where: { id: row.productId },
        select: {
          id: true,
          stock: true
        }
      });

      if (!currentProduct) {
        result.skipped += 1;
        continue;
      }

      const data: Prisma.ProductUpdateInput = {};
      if (row.name) {
        data.name = row.name;
      }

      if (row.barcode) {
        data.barcode = row.barcode;
      }

      if (row.sku) {
        data.sku = row.sku;
      }

      if (row.brand) {
        data.brand = row.brand;
      }

      if (category) {
        data.category = { connect: { id: category.id } };
      }

      if (row.salePrice) {
        data.salePrice = toMoneyDecimal(row.salePrice);
      }

      if (row.cost) {
        data.cost = toMoneyDecimal(row.cost);
      }

      if (row.minStock) {
        data.minStock = toDecimalOrZero(row.minStock);
      }

      if (row.unitTypeProvided) {
        data.unitType = row.unitType;
        data.allowsDecimalQuantity = shouldUseDecimalQuantity(row.unitType);
      }

      if (row.active !== null) {
        data.active = row.active;
      }

      if (row.quickAccess !== null) {
        data.quickAccess = row.quickAccess;
      }

      const newStock = row.stock ? toDecimalOrZero(row.stock) : null;
      if (newStock) {
        data.stock = newStock;
      }

      await tx.product.update({
        where: { id: currentProduct.id },
        data
      });
      result.updated += 1;

      if (newStock && !currentProduct.stock.equals(newStock)) {
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: currentProduct.id,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: newStock.minus(currentProduct.stock),
            previousStock: currentProduct.stock,
            newStock,
            reason: "Importacion Excel",
            userId
          }
        });
        result.stockMovements += 1;
      }
    }

    return result;
  });
}

async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
    redirect("/caja");
  }

  return user;
}

function parseRowsJson(value: string) {
  try {
    const rows = JSON.parse(value) as ProductImportRow[];
    if (!Array.isArray(rows)) {
      throw new Error("payload");
    }

    return rows.map(coerceRow);
  } catch {
    throw new Error("No se pudo leer la previsualizacion.");
  }
}

function coerceRow(row: ProductImportRow): ProductImportRow {
  const unitType = Object.values(UnitType).includes(row.unitType)
    ? row.unitType
    : UnitType.UNIT;

  return {
    rowNumber: Number(row.rowNumber),
    name: text(row.name),
    barcode: text(row.barcode) || null,
    sku: text(row.sku) || null,
    category: text(row.category),
    brand: text(row.brand) || null,
    salePrice: text(row.salePrice) || null,
    cost: text(row.cost) || null,
    stock: text(row.stock) || null,
    minStock: text(row.minStock) || null,
    unitType,
    unitTypeProvided: Boolean(row.unitTypeProvided),
    allowsDecimalQuantity: shouldUseDecimalQuantity(unitType),
    active: typeof row.active === "boolean" ? row.active : null,
    quickAccess: typeof row.quickAccess === "boolean" ? row.quickAccess : null,
    errors: Array.isArray(row.errors) ? row.errors.map(text).filter(Boolean) : []
  };
}

function toMoneyDecimal(value: string) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function toDecimalOrZero(value: string | null) {
  return value ? new Prisma.Decimal(value) : new Prisma.Decimal(0);
}

function unique<T>(values: Array<T | null | undefined>) {
  return [...new Set(values.filter((value): value is T => Boolean(value)))];
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo importar el archivo.";
}
