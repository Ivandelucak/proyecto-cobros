"use server";

import {
  CashMovementType,
  CashSessionStatus,
  type FiscalStatus,
  PaymentMethod,
  Prisma,
  Role
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/lib/audit-log";
import { getCurrentUser } from "@/lib/auth";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { calculateCashSessionSummary } from "@/lib/cash-session";
import { MercadoPagoApiError } from "@/lib/mercadopago/mercado-pago-client";
import {
  cancelMercadoPagoAttempt,
  createMercadoPagoQrOrder,
  getMercadoPagoOrderStatus,
  toAttemptView
} from "@/lib/mercadopago/mercado-pago-orders";
import {
  associateMercadoPagoPaymentByAmount,
  associateMercadoPagoRecentPayment,
  findAmountMatchingCandidates,
  searchRecentMercadoPagoPayments
} from "@/lib/mercadopago/mercado-pago-search";
import { parseLocalizedDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { confirmSale, type ConfirmSaleInput } from "@/lib/sale-engine";

export type CashProductResult = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  salePrice: string;
  stock: string;
  unitType: string;
  allowsDecimalQuantity: boolean;
  categoryName: string;
  quickAccess: boolean;
};

export type CashCustomerResult = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  balance: string;
};

export type ProductSearchResult = {
  products: CashProductResult[];
  exactProductId: string | null;
};

export type BarcodeProductResult =
  | { status: "found"; product: CashProductResult }
  | { status: "not_found" }
  | { status: "inactive"; productName: string }
  | { status: "deleted"; productName: string }
  | { status: "out_of_stock"; productName: string };

export type RegisterPaymentInput = {
  method: string;
  amount: string;
  receivedAmount?: string;
  installments?: number;
  externalId?: string;
  externalReference?: string;
  providerStatus?: string;
  paymentAttemptId?: string;
};

export type RegisterSaleInput = {
  items: Array<{
    productId?: string | null;
    quantity: string;
    isManual?: boolean;
    name?: string;
    unitPrice?: string;
  }>;
  payments: RegisterPaymentInput[];
  customerId?: string | null;
  fiscalInvoiceRequested?: boolean | null;
};

export type RegisterSaleResult = {
  ok: boolean;
  error?: string;
  saleId?: string;
  saleNumber?: number;
  fiscalStatus?: FiscalStatus;
  requiresFiscalInvoice?: boolean;
  suggestedProducts?: CashProductResult[];
};

export type CashSessionFormState = {
  error?: string;
  success?: string;
};

export async function createMercadoPagoQrAttemptAction(input: {
  accountId: string;
  amount: string;
}) {
  const user = await requireCashierUser();

  try {
    const attempt = await createMercadoPagoQrOrder({
      accountId: input.accountId,
      amount: parseLocalizedDecimal(input.amount)
    });

    await createAuditLog({
      userId: user.id,
      action: "MERCADOPAGO_QR_CREATED",
      entity: "PaymentAttempt",
      entityId: attempt.id,
      description: "Genero QR dinamico Mercado Pago.",
      metadata: {
        accountId: input.accountId,
        amount: attempt.amount,
        externalReference: attempt.externalReference
      }
    });

    return { ok: true as const, attempt };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo generar el QR.",
      technicalDetail: formatMercadoPagoTechnicalDetail(error)
    };
  }
}

export async function refreshMercadoPagoAttemptStatusAction(attemptId: string) {
  await requireCashierUser();

  try {
    const attempt = await getMercadoPagoOrderStatus({ attemptId });
    return { ok: true as const, attempt };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo consultar Mercado Pago."
    };
  }
}

function formatMercadoPagoTechnicalDetail(error: unknown) {
  if (error instanceof MercadoPagoApiError) {
    return JSON.stringify(error.details, null, 2);
  }

  if (error instanceof Error) {
    return JSON.stringify({ message: error.message }, null, 2);
  }

  return null;
}

export async function cancelMercadoPagoAttemptAction(attemptId: string) {
  await requireCashierUser();

  try {
    const attempt = await cancelMercadoPagoAttempt({ attemptId });
    return { ok: true as const, attempt };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo cancelar el intento."
    };
  }
}

export async function searchRecentMercadoPagoPaymentsAction(input: {
  accountId: string;
  minutes?: number;
  limit?: number;
}) {
  await requireCashierUser();

  try {
    const movements = await searchRecentMercadoPagoPayments({
      accountId: input.accountId,
      minutes: input.minutes,
      limit: input.limit
    });
    return { ok: true as const, movements };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron consultar cobros recientes.",
      technicalDetail: formatMercadoPagoTechnicalDetail(error)
    };
  }
}

export async function findMercadoPagoAmountMatchesAction(input: {
  accountId: string;
  amount: string;
}) {
  await requireCashierUser();

  try {
    const movements = await findAmountMatchingCandidates({
      accountId: input.accountId,
      amount: parseLocalizedDecimal(input.amount)
    });
    return { ok: true as const, movements };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Sin coincidencias por el monto pendiente.",
      technicalDetail: formatMercadoPagoTechnicalDetail(error)
    };
  }
}

export async function associateMercadoPagoPaymentAction(input: {
  accountId: string;
  paymentId: string;
  amount: string;
}) {
  const user = await requireCashierUser();

  try {
    const attempt = await associateMercadoPagoPaymentByAmount({
      accountId: input.accountId,
      paymentId: input.paymentId,
      amount: parseLocalizedDecimal(input.amount),
      userId: user.id
    });

    await createAuditLog({
      userId: user.id,
      action: "MERCADOPAGO_AMOUNT_MATCH_ASSOCIATED",
      entity: "PaymentAttempt",
      entityId: attempt.id,
      description: "Asocio pago Mercado Pago por match de monto.",
      metadata: { accountId: input.accountId, paymentId: input.paymentId }
    });

    return { ok: true as const, attempt: await toAttemptView(attempt) };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo asociar el pago Mercado Pago.",
      technicalDetail: formatMercadoPagoTechnicalDetail(error)
    };
  }
}

export async function associateMercadoPagoRecentPaymentAction(input: {
  accountId: string;
  paymentId: string;
  paymentMethod?: "MERCADOPAGO" | "TRANSFER";
}) {
  const user = await requireCashierUser();

  try {
    const attempt = await associateMercadoPagoRecentPayment({
      accountId: input.accountId,
      paymentId: input.paymentId,
      paymentMethod:
        input.paymentMethod === "TRANSFER"
          ? PaymentMethod.TRANSFER
          : PaymentMethod.MERCADOPAGO,
      userId: user.id
    });

    await createAuditLog({
      userId: user.id,
      action: "MERCADOPAGO_RECENT_PAYMENT_ASSOCIATED",
      entity: "PaymentAttempt",
      entityId: attempt.id,
      description: "Asocio cobro reciente Mercado Pago.",
      metadata: {
        accountId: input.accountId,
        paymentId: input.paymentId,
        origin: "MANUAL_RECENT_PAYMENT"
      }
    });

    return { ok: true as const, attempt: await toAttemptView(attempt) };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo asociar el cobro Mercado Pago.",
      technicalDetail: formatMercadoPagoTechnicalDetail(error)
    };
  }
}

export async function getSuggestedCashProductsAction() {
  const user = await requireCashierUser();
  const cashSetting = await getCashRegisterSetting(user.businessId!);

  const products = await prisma.product.findMany({
    where: {
      businessId: user.businessId!,
      active: true,
      deletedAt: null,
      ...(cashSetting.allowNegativeStock ? {} : { stock: { gt: 0 } })
    },
    include: {
      category: {
        select: { name: true }
      }
    },
    orderBy: [{ quickAccess: "desc" }, { updatedAt: "desc" }],
    take: cashSetting.quickProductsLimit
  });

  return products.map(mapCashProduct);
}

export async function searchCashProductsAction(query: string): Promise<ProductSearchResult> {
  const user = await requireCashierUser();
  const cashSetting = await getCashRegisterSetting(user.businessId!);

  const search = query.trim();
  if (!search) {
    return { products: [], exactProductId: null };
  }

  const products = await prisma.product.findMany({
    where: {
      businessId: user.businessId!,
      active: true,
      deletedAt: null,
      ...(cashSetting.allowNegativeStock ? {} : { stock: { gt: 0 } }),
      OR: [
        { name: { contains: search } },
        { barcode: { contains: search } },
        { sku: { contains: search } },
        { brand: { contains: search } },
        { category: { name: { contains: search } } }
      ]
    },
    include: {
      category: {
        select: { name: true }
      }
    },
    orderBy: [{ quickAccess: "desc" }, { name: "asc" }],
    take: 16
  });

  const normalizedSearch = search.toLowerCase();
  const exactProduct = products.find(
    (product) =>
      product.barcode?.toLowerCase() === normalizedSearch ||
      product.sku?.toLowerCase() === normalizedSearch
  );

  return {
    exactProductId: exactProduct?.id ?? null,
    products: products.map(mapCashProduct)
  };
}

export async function findCashProductByBarcodeAction(
  barcode: string
): Promise<BarcodeProductResult> {
  const user = await requireCashierUser();
  const cashSetting = await getCashRegisterSetting(user.businessId!);
  const code = barcode.trim();

  if (!code) {
    return { status: "not_found" };
  }

  const product = await prisma.product.findFirst({
    where: { barcode: code, businessId: user.businessId! },
    include: {
      category: {
        select: { name: true }
      }
    }
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

  if (!cashSetting.allowNegativeStock && product.stock.lte(0)) {
    return { status: "out_of_stock", productName: product.name };
  }

  return { status: "found", product: mapCashProduct(product) };
}

export async function searchCashCustomersAction(query: string): Promise<CashCustomerResult[]> {
  const user = await requireCashierUser();

  const search = query.trim();
  if (search.length < 2) {
    return [];
  }

  const customers = await prisma.customer.findMany({
    where: {
      businessId: user.businessId!,
      active: true,
      deletedAt: null,
      OR: [
        { name: { contains: search } },
        { document: { contains: search } },
        { phone: { contains: search } }
      ]
    },
    orderBy: { name: "asc" },
    take: 8
  });

  const balances = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      balance: await prisma.customerAccountMovement.findMany({
        where: { customerId: customer.id },
        select: { type: true, amount: true }
      })
    }))
  );

  return balances.map(({ customer, balance }) => {
    const total = balance.reduce((sum, movement) => {
      const amount = movement.amount;
      return movement.type === "PAYMENT" || movement.type === "SALE_CANCELLED"
        ? sum.minus(amount)
        : sum.plus(amount);
    }, new Prisma.Decimal(0));

    return {
      id: customer.id,
      name: customer.name,
      document: customer.document,
      phone: customer.phone,
      balance: total.toDecimalPlaces(2).toString()
    };
  });
}

export async function confirmRegisterSaleAction(
  input: RegisterSaleInput
): Promise<RegisterSaleResult> {
  const user = await requireCashierUser();

  try {
    if (input.items.length === 0) {
      throw new Error("Agrega al menos un producto.");
    }

    if (input.payments.length === 0) {
      throw new Error("Agrega al menos un pago.");
    }

    const items = input.items.map((item) => ({
      productId: item.productId ?? null,
      quantity: parseLocalizedDecimal(item.quantity),
      isManual: item.isManual ?? false,
      name: item.name,
      unitPrice: item.unitPrice ? parseLocalizedDecimal(item.unitPrice) : undefined
    }));
    const payments = buildPayments(input.payments);
    const sale = await confirmSale({
      userId: user.id,
      customerId: input.customerId ?? null,
      items,
      payments,
      fiscalInvoiceRequested: input.fiscalInvoiceRequested ?? null
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "Sale",
      entityId: sale.id,
      description: `Registro venta #${sale.saleNumber}.`,
      metadata: { total: sale.total.toString() }
    });

    revalidatePath("/caja");
    revalidatePath("/productos");
    revalidatePath("/stock");
    revalidatePath("/ventas");
    revalidatePath("/clientes");
    revalidatePath("/facturacion");

    return {
      ok: true,
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      fiscalStatus: sale.fiscalStatus,
      requiresFiscalInvoice: sale.requiresFiscalInvoice,
      suggestedProducts: await getSuggestedCashProductsAction()
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo confirmar la venta."
    };
  }
}

export async function openCashSessionAction(
  _prevState: CashSessionFormState,
  formData: FormData
): Promise<CashSessionFormState> {
  const user = await requireCashierUser();

  try {
    const existingOpenSession = await prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN, businessId: user.businessId! },
      select: { id: true }
    });

    if (existingOpenSession) {
      throw new Error("Ya hay una caja abierta.");
    }

    const openingAmount = parseLocalizedDecimal(formData.get("openingAmount")).toDecimalPlaces(2);
    if (openingAmount.lt(0)) {
      throw new Error("El monto inicial no puede ser negativo.");
    }

    const cashSession = await prisma.cashSession.create({
      data: {
        businessId: user.businessId!,
        openingAmount,
        notes: readOptionalText(formData, "notes"),
        status: CashSessionStatus.OPEN,
        openedById: user.id
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "OPEN",
      entity: "CashSession",
      entityId: cashSession.id,
      description: "Abrio caja.",
      metadata: { openingAmount: openingAmount.toString() }
    });

    revalidatePath("/caja");
    revalidatePath("/admin");

    return { success: "Caja abierta." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function addCashMovementAction(
  _prevState: CashSessionFormState,
  formData: FormData
): Promise<CashSessionFormState> {
  const user = await requireCashierUser();

  try {
    const openSession = await prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN, businessId: user.businessId! },
      select: { id: true }
    });

    if (!openSession) {
      throw new Error("No hay caja abierta.");
    }

    const type = String(formData.get("type") ?? "");
    if (!Object.values(CashMovementType).includes(type as CashMovementType)) {
      throw new Error("Tipo de movimiento invalido.");
    }

    const amount = parseLocalizedDecimal(formData.get("amount")).toDecimalPlaces(2);
    if (amount.lte(0)) {
      throw new Error("El monto debe ser mayor a cero.");
    }

    const reason = readText(formData, "reason");
    if (!reason) {
      throw new Error("El motivo es obligatorio.");
    }

    const movement = await prisma.cashMovement.create({
      data: {
        cashSessionId: openSession.id,
        type: type as CashMovementType,
        amount,
        reason,
        userId: user.id
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "CashMovement",
      entityId: movement.id,
      description: "Registro movimiento de caja.",
      metadata: {
        type,
        amount: amount.toString(),
        reason
      }
    });

    revalidatePath("/caja");
    revalidatePath("/admin");

    return { success: "Movimiento registrado." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function closeCashSessionAction(
  _prevState: CashSessionFormState,
  formData: FormData
): Promise<CashSessionFormState> {
  const user = await requireCashierUser();

  try {
    const openSession = await prisma.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN, businessId: user.businessId! },
      select: { id: true }
    });

    if (!openSession) {
      throw new Error("No hay caja abierta.");
    }

    const countedCashAmount = parseLocalizedDecimal(formData.get("countedCashAmount")).toDecimalPlaces(2);
    if (countedCashAmount.lt(0)) {
      throw new Error("El efectivo contado no puede ser negativo.");
    }

    const summary = await calculateCashSessionSummary(openSession.id);
    const expectedCashAmount = new Prisma.Decimal(summary.expectedCash).toDecimalPlaces(2);
    const differenceAmount = countedCashAmount.minus(expectedCashAmount).toDecimalPlaces(2);

    await prisma.cashSession.update({
      where: { id: openSession.id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt: new Date(),
        closedById: user.id,
        countedCashAmount,
        expectedCashAmount,
        differenceAmount,
        notes: readOptionalText(formData, "notes")
      }
    });

    await createAuditLog({
      userId: user.id,
      action: "CLOSE",
      entity: "CashSession",
      entityId: openSession.id,
      description: "Cerro caja.",
      metadata: {
        countedCashAmount: countedCashAmount.toString(),
        expectedCashAmount: expectedCashAmount.toString(),
        differenceAmount: differenceAmount.toString()
      }
    });

    revalidatePath("/caja");
    revalidatePath("/admin");
    revalidatePath("/reportes");

    return { success: "Caja cerrada." };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

async function requireCashierUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }

  return user;
}

function buildPayments(payments: RegisterPaymentInput[]): ConfirmSaleInput["payments"] {
  const creditPayments = payments.filter((payment) => payment.method === PaymentMethod.CREDIT);
  if (creditPayments.length > 1) {
    throw new Error("Solo se permite un pago con credito por venta.");
  }

  return payments.map((payment) => {
    if (!Object.values(PaymentMethod).includes(payment.method as PaymentMethod)) {
      throw new Error("Medio de pago invalido.");
    }

    const method = payment.method as PaymentMethod;
    const amount = parseLocalizedDecimal(payment.amount).toDecimalPlaces(2);

    if (amount.lte(0)) {
      throw new Error("El importe del pago debe ser mayor a cero.");
    }

    if (method === PaymentMethod.CASH) {
      const receivedAmount =
        payment.receivedAmount === undefined || payment.receivedAmount === ""
          ? amount
          : parseLocalizedDecimal(payment.receivedAmount).toDecimalPlaces(2);

      if (receivedAmount.lt(amount)) {
        throw new Error("El monto recibido no puede ser menor al importe aplicado.");
      }

      return {
        method,
        amount,
        receivedAmount,
        externalId: normalizeOptionalPaymentText(payment.externalId),
        externalReference: normalizeOptionalPaymentText(payment.externalReference),
        providerStatus: normalizeOptionalPaymentText(payment.providerStatus),
        paymentAttemptId: normalizeOptionalPaymentText(payment.paymentAttemptId)
      };
    }

    if (method === PaymentMethod.CREDIT) {
      return {
        method,
        amount,
        installments: Number(payment.installments ?? 1),
        externalId: normalizeOptionalPaymentText(payment.externalId),
        externalReference: normalizeOptionalPaymentText(payment.externalReference),
        providerStatus: normalizeOptionalPaymentText(payment.providerStatus),
        paymentAttemptId: normalizeOptionalPaymentText(payment.paymentAttemptId)
      };
    }

    return {
      method,
      amount,
      externalId: normalizeOptionalPaymentText(payment.externalId),
      externalReference: normalizeOptionalPaymentText(payment.externalReference),
      providerStatus: normalizeOptionalPaymentText(payment.providerStatus),
      paymentAttemptId: normalizeOptionalPaymentText(payment.paymentAttemptId)
    };
  });
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  return readText(formData, key) || null;
}

function normalizeOptionalPaymentText(value: string | undefined) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 180) : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operacion.";
}

function mapCashProduct(product: {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  salePrice: Prisma.Decimal;
  stock: Prisma.Decimal;
  unitType: string;
  allowsDecimalQuantity: boolean;
  category: { name: string };
  quickAccess: boolean;
}): CashProductResult {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    sku: product.sku,
    salePrice: product.salePrice.toString(),
    stock: product.stock.toString(),
    unitType: product.unitType,
    allowsDecimalQuantity: product.allowsDecimalQuantity,
    categoryName: product.category.name,
    quickAccess: product.quickAccess
  };
}
