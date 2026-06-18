"use server";

import { Prisma, Role, StockMovementType, UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { shouldUseDecimalQuantity } from "@/lib/stock-format";

export type ProductFormState = {
  error?: string;
};

type ParsedProductForm = {
  name: string;
  barcode: string | null;
  sku: string | null;
  brand: string | null;
  categoryId: string;
  salePrice: Prisma.Decimal;
  cost: Prisma.Decimal | null;
  stock: Prisma.Decimal;
  minStock: Prisma.Decimal;
  unitType: UnitType;
  allowsDecimalQuantity: boolean;
  quickAccess: boolean;
  active: boolean;
};

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireAdminUser();
  const submitIntent = readString(formData, "submitIntent");

  try {
    const data = await parseProductForm(formData);
    await validateUniqueProductFields(data);
    let productId = "";

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data
      });
      productId = product.id;

      if (!data.stock.equals(0)) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: data.stock,
            previousStock: new Prisma.Decimal(0),
            newStock: data.stock,
            reason: "Stock inicial al crear producto",
            userId: user.id
          }
        });
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Product",
      entityId: productId,
      description: `Creo el producto ${data.name}.`
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/productos");
  redirect(submitIntent === "createAnother" ? "/productos/nuevo" : "/productos");
}

export async function updateProductAction(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireAdminUser();

  try {
    const data = await parseProductForm(formData);
    await validateUniqueProductFields(data, productId);

    await prisma.$transaction(async (tx) => {
      const currentProduct = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, stock: true }
      });

      if (!currentProduct) {
        throw new Error("Producto no encontrado.");
      }

      await tx.product.update({
        where: { id: productId },
        data
      });

      if (!currentProduct.stock.equals(data.stock)) {
        await tx.stockMovement.create({
          data: {
            productId,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: data.stock.minus(currentProduct.stock),
            previousStock: currentProduct.stock,
            newStock: data.stock,
            reason: "Ajuste desde edición de producto",
            userId: user.id
          }
        });
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "Product",
      entityId: productId,
      description: `Actualizo el producto ${data.name}.`
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}/editar`);
  redirect("/productos");
}

export async function setProductActiveAction(productId: string, active: boolean) {
  const user = await requireAdminUser();

  const product = await prisma.product.update({
    where: { id: productId },
    data: { active }
  });

  await createAuditLog({
    userId: user.id,
    action: active ? "REACTIVATE" : "DEACTIVATE",
    entity: "Product",
    entityId: product.id,
    description: `${active ? "Reactivo" : "Desactivo"} el producto ${product.name}.`
  });

  revalidatePath("/productos");
}

async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.ADMIN) {
    redirect("/caja");
  }

  return user;
}

async function parseProductForm(formData: FormData): Promise<ParsedProductForm> {
  const name = readString(formData, "name");
  const categoryId = readString(formData, "categoryId");
  const unitType = parseUnitType(readString(formData, "unitType") || UnitType.UNIT);
  const salePrice = parseNonNegativeDecimal(formData.get("salePrice"), "El precio de venta");
  const costValue = readString(formData, "cost");
  const cost = costValue ? parseNonNegativeDecimal(costValue, "El costo") : null;
  const stock = parseNonNegativeDecimal(formData.get("stock"), "El stock");
  const minStock = parseNonNegativeDecimal(formData.get("minStock"), "El stock mínimo");

  if (!name) {
    throw new Error("El nombre es obligatorio.");
  }

  if (!categoryId) {
    throw new Error("La categoría es obligatoria.");
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true }
  });

  if (!category) {
    throw new Error("La categoría seleccionada no existe.");
  }

  const requestedDecimal = formData.get("allowsDecimalQuantity") === "on";

  return {
    name,
    barcode: readOptionalString(formData, "barcode"),
    sku: readOptionalString(formData, "sku"),
    brand: readOptionalString(formData, "brand"),
    categoryId,
    salePrice,
    cost,
    stock,
    minStock,
    unitType,
    allowsDecimalQuantity: requestedDecimal || shouldUseDecimalQuantity(unitType),
    quickAccess: formData.get("quickAccess") === "on",
    active: formData.get("active") === "on"
  };
}

async function validateUniqueProductFields(data: ParsedProductForm, excludeId?: string) {
  if (data.barcode) {
    const existingBarcode = await prisma.product.findFirst({
      where: {
        barcode: data.barcode,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: { id: true }
    });

    if (existingBarcode) {
      throw new Error("Ya existe un producto con ese código de barras.");
    }
  }

  if (data.sku) {
    const existingSku = await prisma.product.findFirst({
      where: {
        sku: data.sku,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: { id: true }
    });

    if (existingSku) {
      throw new Error("Ya existe un producto con ese SKU.");
    }
  }
}

function parseUnitType(value: string) {
  if (Object.values(UnitType).includes(value as UnitType)) {
    return value as UnitType;
  }

  throw new Error("La unidad seleccionada no es válida.");
}

function parseNonNegativeDecimal(value: unknown, label: string) {
  const decimal = parseLocalizedDecimal(value);

  if (decimal.lt(0)) {
    throw new Error(`${label} debe ser mayor o igual a 0.`);
  }

  return decimal;
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el producto.";
}
