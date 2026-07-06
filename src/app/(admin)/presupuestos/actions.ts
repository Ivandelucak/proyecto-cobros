"use server";

import { Prisma, QuoteStatus, Role, UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type QuoteProductResult = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  salePrice: string;
  unitType: UnitType;
  allowsDecimalQuantity: boolean;
  categoryName: string;
  stock: string;
};

export type QuoteCustomerResult = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
};

export type QuoteSearchResult = {
  products: QuoteProductResult[];
  exactProductId: string | null;
};

export type QuoteFormState = {
  error?: string;
};

type QuotePayload = {
  customerId?: string | null;
  customerName?: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;
  validUntil?: string;
  notes?: string;
  terms?: string;
  discountTotal?: string;
  surchargeTotal?: string;
  items: Array<{
    productId?: string | null;
    productName?: string;
    quantity: string;
    unitPrice: string;
    unitType: UnitType;
    notes?: string;
  }>;
};

export async function searchQuoteProductsAction(query: string): Promise<QuoteSearchResult> {
  await requireQuoteUser();
  const search = query.trim();

  if (!search) {
    return { products: [], exactProductId: null };
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null,
      OR: [
        { name: { contains: search } },
        { barcode: { contains: search } },
        { sku: { contains: search } },
        { brand: { contains: search } },
        { category: { name: { contains: search } } }
      ]
    },
    include: { category: { select: { name: true } } },
    orderBy: [{ quickAccess: "desc" }, { name: "asc" }],
    take: 16
  });
  const normalized = search.toLowerCase();
  const exactProduct = products.find(
    (product) =>
      product.barcode?.toLowerCase() === normalized ||
      product.sku?.toLowerCase() === normalized
  );

  return {
    products: products.map(mapQuoteProduct),
    exactProductId: exactProduct?.id ?? null
  };
}

export async function findQuoteProductByBarcodeAction(
  barcode: string
): Promise<
  | { status: "found"; product: QuoteProductResult }
  | { status: "not_found" }
  | { status: "inactive"; productName: string }
  | { status: "deleted"; productName: string }
> {
  await requireQuoteUser();
  const code = barcode.trim();

  if (!code) {
    return { status: "not_found" };
  }

  const product = await prisma.product.findFirst({
    where: { barcode: code },
    include: { category: { select: { name: true } } }
  });

  if (!product) {
    return { status: "not_found" };
  }

  if (product.deletedAt) {
    return { status: "deleted", productName: product.name };
  }

  if (!product.active) {
    return { status: "inactive", productName: product.name };
  }

  return { status: "found", product: mapQuoteProduct(product) };
}

export async function searchQuoteCustomersAction(
  query: string
): Promise<QuoteCustomerResult[]> {
  await requireQuoteUser();
  const search = query.trim();

  if (search.length < 2) {
    return [];
  }

  const customers = await prisma.customer.findMany({
    where: {
      active: true,
      deletedAt: null,
      OR: [
        { name: { contains: search } },
        { businessName: { contains: search } },
        { document: { contains: search } },
        { docNumber: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      ]
    },
    orderBy: { name: "asc" },
    take: 10
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.businessName ?? customer.name,
    document: customer.docNumber ?? customer.document,
    phone: customer.phone,
    email: customer.email
  }));
}

export async function createQuoteAction(
  _state: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const user = await requireQuoteUser();
  let createdQuoteId = "";

  try {
    const input = await parseQuoteForm(formData);
    const quote = await prisma.quote.create({
      data: {
        businessId: user.businessId!,
        customerId: input.customerId,
        customerNameSnapshot: input.customerNameSnapshot,
        customerDocumentSnapshot: input.customerDocumentSnapshot,
        customerPhoneSnapshot: input.customerPhoneSnapshot,
        customerEmailSnapshot: input.customerEmailSnapshot,
        status: QuoteStatus.DRAFT,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        surchargeTotal: input.surchargeTotal,
        total: input.total,
        validUntil: input.validUntil,
        notes: input.notes,
        terms: input.terms,
        createdById: user.id,
        items: {
          create: input.items
        }
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Quote",
      entityId: quote.id,
      description: `Creo presupuesto #${quote.quoteNumber}.`,
      metadata: { total: quote.total.toString() }
    });

    revalidateQuotePaths(quote.id);
    createdQuoteId = quote.id;
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  redirect(`/presupuestos/${createdQuoteId}`);
}

export async function updateQuoteAction(
  quoteId: string,
  _state: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const user = await requireQuoteUser();
  let updated = false;

  try {
    const input = await parseQuoteForm(formData);
    const current = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, quoteNumber: true }
    });

    if (!current) {
      throw new Error("Presupuesto no encontrado.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          customerId: input.customerId,
          customerNameSnapshot: input.customerNameSnapshot,
          customerDocumentSnapshot: input.customerDocumentSnapshot,
          customerPhoneSnapshot: input.customerPhoneSnapshot,
          customerEmailSnapshot: input.customerEmailSnapshot,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          surchargeTotal: input.surchargeTotal,
          total: input.total,
          validUntil: input.validUntil,
          notes: input.notes,
          terms: input.terms
        }
      });
      await tx.quoteItem.deleteMany({ where: { quoteId } });
      await tx.quoteItem.createMany({
        data: input.items.map((item) => ({
          ...item,
          quoteId
        }))
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "Quote",
      entityId: quoteId,
      description: `Actualizo presupuesto #${current.quoteNumber}.`
    });

    revalidateQuotePaths(quoteId);
    updated = true;
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  if (updated) {
    redirect(`/presupuestos/${quoteId}`);
  }

  return {};
}

export async function changeQuoteStatusAction(quoteId: string, formData: FormData) {
  const user = await requireQuoteUser();
  const status = String(formData.get("status") ?? "");

  if (!Object.values(QuoteStatus).includes(status as QuoteStatus)) {
    throw new Error("Estado de presupuesto invalido.");
  }

  const quote = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: status as QuoteStatus },
    select: { id: true, quoteNumber: true, status: true }
  });

  await createAuditLog({
    userId: user.id,
    action: "QUOTE_STATUS_UPDATE",
    entity: "Quote",
    entityId: quote.id,
    description: `Cambio estado del presupuesto #${quote.quoteNumber} a ${quote.status}.`
  });

  revalidateQuotePaths(quote.id);
}

export async function duplicateQuoteAction(quoteId: string) {
  const user = await requireQuoteUser();
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true }
  });

  if (!quote) {
    throw new Error("Presupuesto no encontrado.");
  }

  const duplicated = await prisma.quote.create({
    data: {
      businessId: user.businessId!,
      customerId: quote.customerId,
      customerNameSnapshot: quote.customerNameSnapshot,
      customerDocumentSnapshot: quote.customerDocumentSnapshot,
      customerPhoneSnapshot: quote.customerPhoneSnapshot,
      customerEmailSnapshot: quote.customerEmailSnapshot,
      status: QuoteStatus.DRAFT,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      surchargeTotal: quote.surchargeTotal,
      total: quote.total,
      validUntil: quote.validUntil,
      notes: quote.notes,
      terms: quote.terms,
      createdById: user.id,
      items: {
        create: quote.items.map((item) => ({
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          unitTypeSnapshot: item.unitTypeSnapshot,
          notes: item.notes
        }))
      }
    }
  });

  await createAuditLog({
    userId: user.id,
    action: "DUPLICATE",
    entity: "Quote",
    entityId: duplicated.id,
    description: `Duplico presupuesto #${quote.quoteNumber} como #${duplicated.quoteNumber}.`
  });

  revalidateQuotePaths(duplicated.id);
  redirect(`/presupuestos/${duplicated.id}/editar`);
}

async function requireQuoteUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }

  return user;
}

async function parseQuoteForm(formData: FormData) {
  const rawPayload = String(formData.get("payload") ?? "");
  if (!rawPayload) {
    throw new Error("Faltan datos del presupuesto.");
  }

  const payload = JSON.parse(rawPayload) as QuotePayload;
  const customer = payload.customerId
    ? await prisma.customer.findFirst({
        where: { id: payload.customerId, active: true, deletedAt: null }
      })
    : null;

  if (payload.customerId && !customer) {
    throw new Error("El cliente seleccionado no existe o esta inactivo.");
  }

  const customerNameSnapshot = (
    customer?.businessName ??
    customer?.name ??
    payload.customerName ??
    ""
  ).trim();

  if (!customerNameSnapshot) {
    throw new Error("El nombre del cliente es obligatorio.");
  }

  if (!payload.items?.length) {
    throw new Error("Agrega al menos un producto al presupuesto.");
  }

  const productIds = payload.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      active: true,
      deletedAt: true
    }
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const items = payload.items.map((item) => {
    const product = item.productId ? productMap.get(item.productId) : null;
    if (item.productId && (!product || product.deletedAt || !product.active)) {
      throw new Error("Uno de los productos no existe o esta inactivo.");
    }

    const quantity = parsePositiveDecimal(item.quantity, "La cantidad");
    const unitPrice = parseNonNegativeDecimal(item.unitPrice, "El precio");
    const subtotal = quantity.mul(unitPrice).toDecimalPlaces(2);
    const unitType = parseUnitType(item.unitType);
    const productNameSnapshot = (product?.name ?? item.productName ?? "").trim();

    if (!productNameSnapshot) {
      throw new Error("Todos los items deben tener nombre de producto.");
    }

    return {
      productId: item.productId || null,
      productNameSnapshot,
      quantity,
      unitPrice,
      subtotal,
      unitTypeSnapshot: unitType,
      notes: trimOptional(item.notes)
    };
  });
  const subtotal = sum(items.map((item) => item.subtotal)).toDecimalPlaces(2);
  const discountTotal = parseOptionalMoney(payload.discountTotal, "El descuento");
  const surchargeTotal = parseOptionalMoney(payload.surchargeTotal, "El recargo");
  const total = subtotal.minus(discountTotal).plus(surchargeTotal).toDecimalPlaces(2);

  if (total.lt(0)) {
    throw new Error("El total del presupuesto no puede ser negativo.");
  }

  return {
    customerId: customer?.id ?? null,
    customerNameSnapshot,
    customerDocumentSnapshot: customer
      ? customer.docNumber ?? customer.document
      : trimOptional(payload.customerDocument),
    customerPhoneSnapshot: customer ? customer.phone : trimOptional(payload.customerPhone),
    customerEmailSnapshot: customer ? customer.email : trimOptional(payload.customerEmail),
    subtotal,
    discountTotal,
    surchargeTotal,
    total,
    validUntil: parseOptionalDate(payload.validUntil, "Validez"),
    notes: trimOptional(payload.notes),
    terms: trimOptional(payload.terms),
    items
  };
}

function parsePositiveDecimal(value: unknown, label: string) {
  const decimal = parseLocalizedDecimal(value).toDecimalPlaces(3);
  if (decimal.lte(0)) {
    throw new Error(`${label} debe ser mayor a cero.`);
  }
  return decimal;
}

function parseNonNegativeDecimal(value: unknown, label: string) {
  const decimal = parseLocalizedDecimal(value).toDecimalPlaces(2);
  if (decimal.lt(0)) {
    throw new Error(`${label} no puede ser negativo.`);
  }
  return decimal;
}

function parseOptionalMoney(value: unknown, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return new Prisma.Decimal(0);
  }
  return parseNonNegativeDecimal(raw, label);
}

function parseUnitType(value: string) {
  if (Object.values(UnitType).includes(value as UnitType)) {
    return value as UnitType;
  }

  throw new Error("Unidad invalida.");
}

function parseOptionalDate(value: string | undefined, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    throw new Error(`${label} debe tener formato AAAA-MM-DD.`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${label} no es una fecha valida.`);
  }

  return date;
}

function trimOptional(value: string | undefined | null) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
}

function revalidateQuotePaths(quoteId: string) {
  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${quoteId}`);
  revalidatePath(`/presupuestos/${quoteId}/editar`);
  revalidatePath(`/presupuestos/${quoteId}/imprimir`);
}

function mapQuoteProduct(product: {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  salePrice: Prisma.Decimal;
  stock: Prisma.Decimal;
  unitType: UnitType;
  allowsDecimalQuantity: boolean;
  category: { name: string };
}): QuoteProductResult {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    sku: product.sku,
    salePrice: product.salePrice.toString(),
    stock: product.stock.toString(),
    unitType: product.unitType,
    allowsDecimalQuantity: product.allowsDecimalQuantity,
    categoryName: product.category.name
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el presupuesto.";
}
