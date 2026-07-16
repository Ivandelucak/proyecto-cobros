import {
  CashSessionStatus,
  CustomerAccountMovementType,
  PaymentMethod,
  PaymentProvider,
  Prisma,
  Role,
  SaleStatus,
  StockMovementType,
  UnitType
} from "@prisma/client";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { createCustomerAccountMovement } from "@/lib/customer-account";
import { applyFiscalDecisionToSale } from "@/lib/fiscal/fiscal-engine";
import {
  determineFiscalRequirementForSale,
  type FiscalRequirementDecision
} from "@/lib/fiscal/fiscal-policy";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import {
  getActiveCreditInstallmentPlans,
  getPaymentMethodSettings
} from "@/lib/payment-settings";
import { assertRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { allocateNextSaleNumber, formatInternalSaleNumber } from "@/lib/sale-numbering";

type SaleItemInput = {
  productId?: string | null;
  quantity: Prisma.Decimal.Value;
  isManual?: boolean;
  name?: string;
  unitPrice?: Prisma.Decimal.Value;
  unitTypeSnapshot?: UnitType;
  allowsDecimalQuantity?: boolean;
};

type PaymentInput = {
  method: PaymentMethod;
  amount: Prisma.Decimal.Value;
  receivedAmount?: Prisma.Decimal.Value;
  changeAmount?: Prisma.Decimal.Value;
  installments?: number;
  externalId?: string;
  externalReference?: string;
  providerStatus?: string;
  paymentAttemptId?: string;
};

export type ConfirmSaleInput = {
  userId: string;
  customerId?: string | null;
  items: SaleItemInput[];
  payments: PaymentInput[];
  fiscalInvoiceRequested?: boolean | null;
  offline?: {
    clientOperationId: string;
    businessId: string;
    userId: string;
    cashSessionId: string;
    occurredAt: Date;
  };
};

export class OfflineSaleSyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = true
  ) {
    super(message);
    this.name = "OfflineSaleSyncError";
  }
}

type ActiveCreditInstallmentPlan = {
  installments: number;
  surchargeRate: string;
};

export async function confirmSale(input: ConfirmSaleInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.active) {
    throw new Error("Usuario inválido.");
  }

  assertRole(user.role, [Role.OWNER, Role.ADMIN, Role.CASHIER], "confirmar ventas");

  if (input.items.length === 0) {
    throw new Error("La venta no tiene productos.");
  }

  if (input.payments.length === 0) {
    throw new Error("La venta no tiene pagos.");
  }

  const offline = input.offline;
  if (offline) {
    validateOfflineInput(offline, user);
    if (
      input.payments.length !== 1 ||
      input.payments[0]?.method !== PaymentMethod.CASH
    ) {
      throw new OfflineSaleSyncError(
        "Las ventas offline solo admiten un pago en efectivo.",
        "OFFLINE_CASH_ONLY",
        false
      );
    }

    const existingSale = await prisma.sale.findFirst({
      where: {
        businessId: user.businessId!,
        clientOperationId: offline.clientOperationId
      },
      include: { items: true, payments: true, user: true }
    });
    if (existingSale) {
      return { ...existingSale, offlineSyncLate: false };
    }
  }

  try {
  return await prisma.$transaction(async (tx) => {
    const cashSetting = await getCashRegisterSetting(user.businessId ?? undefined, tx);
    const cashSession = offline
      ? await tx.cashSession.findFirst({
          where: { id: offline.cashSessionId, businessId: user.businessId! },
          select: {
            id: true,
            status: true,
            openedAt: true,
            closedAt: true,
            openingAmount: true,
            expectedCashAmount: true,
            countedCashAmount: true
          }
        })
      : await tx.cashSession.findFirst({
          where: { status: CashSessionStatus.OPEN, businessId: user.businessId! },
          select: {
            id: true,
            status: true,
            openedAt: true,
            closedAt: true,
            openingAmount: true,
            expectedCashAmount: true,
            countedCashAmount: true
          }
        });

    if (!offline && cashSetting.requireOpenSession && !cashSession) {
      throw new Error("No hay caja abierta para registrar la venta.");
    }

    const lateCashSession = offline
      ? validateOfflineCashSession(cashSession, offline.occurredAt)
      : false;

    const catalogItems = input.items.filter((item) => !item.isManual);
    const manualItems = input.items.filter((item) => item.isManual);

    const productIds = [
      ...new Set(catalogItems.map((item) => item.productId).filter(Boolean))
    ] as string[];
    if (productIds.length !== catalogItems.length) {
      throw new Error("Producto invalido.");
    }
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        businessId: user.businessId!,
        ...(offline ? {} : { active: true, deletedAt: null })
      }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    if (productsById.size !== productIds.length) {
      if (offline) {
        throw new OfflineSaleSyncError(
          "Uno de los productos de la venta offline ya no existe en este comercio.",
          "OFFLINE_PRODUCT_NOT_FOUND"
        );
      }
      throw new Error("Uno o más productos no están disponibles.");
    }

    const groupedCatalogItems: Array<{
      productId: string;
      quantity: Prisma.Decimal;
      name?: string;
      unitPrice?: Prisma.Decimal.Value;
      unitTypeSnapshot?: UnitType;
      allowsDecimalQuantity?: boolean;
    }> = offline
      ? catalogItems.map((item) => ({
          productId: item.productId!,
          quantity: new Prisma.Decimal(item.quantity),
          name: item.name,
          unitPrice: item.unitPrice,
          unitTypeSnapshot: item.unitTypeSnapshot,
          allowsDecimalQuantity: item.allowsDecimalQuantity
        }))
      : groupSaleItems(catalogItems);
    let subtotal = new Prisma.Decimal(0);

    const catalogSaleItems = groupedCatalogItems.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new Error("Producto inválido.");
      }

      if (item.quantity.lte(0)) {
        throw new Error(`La cantidad de ${product.name} debe ser mayor a cero.`);
      }

      const allowsDecimalQuantity = offline
        ? Boolean(item.allowsDecimalQuantity)
        : product.allowsDecimalQuantity;
      if (!allowsDecimalQuantity && !item.quantity.mod(1).equals(0)) {
        throw new Error(`${product.name} no permite cantidades decimales.`);
      }

      if (!offline && !cashSetting.allowNegativeStock && product.stock.lt(item.quantity)) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      const unitPrice = offline
        ? new Prisma.Decimal(item.unitPrice ?? 0).toDecimalPlaces(2)
        : product.salePrice;
      if (unitPrice.lte(0)) {
        throw new Error(`El precio de ${product.name} debe ser mayor a cero.`);
      }
      const itemSubtotal = unitPrice.mul(item.quantity).toDecimalPlaces(2);
      subtotal = subtotal.plus(itemSubtotal);

      return {
        product,
        quantity: item.quantity,
        isManual: false,
        data: {
          productId: product.id,
          productNameSnapshot: offline ? item.name?.trim() || product.name : product.name,
          unitPrice,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          unitTypeSnapshot: offline ? item.unitTypeSnapshot ?? product.unitType : product.unitType,
          isManual: false
        }
      };
    });

    const manualSaleItems = manualItems.map((item) => {
      if (!item.name || item.name.trim().length < 2) {
        throw new Error("El nombre del artículo manual debe tener al menos 2 caracteres.");
      }
      if (item.name.trim().length > 80) {
        throw new Error("El nombre del artículo manual es demasiado largo.");
      }
      const unitPrice = new Prisma.Decimal(item.unitPrice ?? 0);
      if (unitPrice.lte(0)) {
        throw new Error("El precio del artículo manual debe ser mayor a cero.");
      }
      const quantity = new Prisma.Decimal(item.quantity);
      if (quantity.lte(0)) {
        throw new Error("La cantidad del artículo manual debe ser mayor a cero.");
      }

      const itemSubtotal = unitPrice.mul(quantity).toDecimalPlaces(2);
      subtotal = subtotal.plus(itemSubtotal);

      return {
        product: null,
        quantity,
        isManual: true,
        data: {
          productId: null,
          productNameSnapshot: item.name.trim(),
          unitPrice,
          quantity,
          subtotal: itemSubtotal,
          unitTypeSnapshot: "UNIT" as const,
          isManual: true
        }
      };
    });

    const saleItems = [...catalogSaleItems, ...manualSaleItems];

    const [paymentMethodSettings, activeCreditPlans, fiscalSetting] = await Promise.all([
      getPaymentMethodSettings(user.businessId ?? undefined, tx),
      getActiveCreditInstallmentPlans(tx),
      getFiscalSettingOrDefault(user.businessId ?? undefined, tx)
    ]);
    const paymentMethodSettingsByCode = new Map(
      paymentMethodSettings.map((setting) => [setting.method, setting])
    );
    const enabledMethodCodes = new Set(
      paymentMethodSettings
        .filter((setting) => setting.enabled)
        .map((setting) => setting.method)
    );

    const validatedPayments = input.payments.map((payment) => {
      if (offline) {
        return {
          ...payment,
          externalId: undefined,
          externalReference: undefined,
          providerStatus: "OFFLINE_CASH"
        };
      }
      if (!enabledMethodCodes.has(payment.method)) {
        throw new Error("El medio de pago seleccionado no esta habilitado.");
      }

      const setting = paymentMethodSettingsByCode.get(payment.method);
      const reference = normalizeOptionalPaymentText(
        payment.externalReference ?? payment.externalId
      );
      if (requiresServerReference(payment.method, setting?.askReference) && !reference) {
        throw new Error("El medio de pago seleccionado requiere referencia.");
      }

      return {
        ...payment,
        externalId: normalizeOptionalPaymentText(payment.externalId ?? reference),
        externalReference: normalizeOptionalPaymentText(
          payment.externalReference ?? reference
        ),
        providerStatus: normalizeOptionalPaymentText(
          payment.providerStatus ?? setting?.defaultProviderStatus ?? null
        )
      };
    });

    const discountTotal = new Prisma.Decimal(0);
    const approvedAttemptsById = await validatePaymentAttempts(
      tx,
      validatedPayments
    );
    const { paymentRecords, surchargeTotal } = buildPaymentRecords(
      validatedPayments,
      subtotal,
      activeCreditPlans,
      approvedAttemptsById
    );
    const fiscalDecision: FiscalRequirementDecision = offline
      ? {
          requiresFiscalInvoice: false,
          fiscalStatus: "NOT_REQUESTED",
          fiscalRequestedAt: null,
          decisionSource: "CASH"
        }
      : determineFiscalRequirementForSale({
          payments: paymentRecords.map((payment) => ({ method: payment.method })),
          setting: fiscalSetting,
          cashierRequestedInvoice: input.fiscalInvoiceRequested ?? null
        });
    const total = subtotal.plus(surchargeTotal).minus(discountTotal).toDecimalPlaces(2);
    const currentAccountTotal = paymentRecords
      .filter((payment) => payment.method === PaymentMethod.CURRENT_ACCOUNT)
      .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0))
      .toDecimalPlaces(2);

    let customerId: string | null = null;
    if (currentAccountTotal.gt(0)) {
      if (!input.customerId) {
        throw new Error("Selecciona un cliente para cuenta corriente.");
      }

      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, active: true, deletedAt: null },
        select: { id: true }
      });

      if (!customer) {
        throw new Error("Cliente invalido para cuenta corriente.");
      }

      customerId = customer.id;
    }

    const paymentTotal = paymentRecords.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0)
    );

    if (!paymentTotal.equals(total)) {
      throw new Error("La suma de pagos debe coincidir con el total de la venta.");
    }

    const occurredAt = offline?.occurredAt ?? new Date();
    const internalSaleNumber = await allocateNextSaleNumber(
      tx,
      user.businessId!,
      occurredAt
    );

    const sale = await tx.sale.create({
      data: {
        businessId: user.businessId!,
        userId: user.id,
        internalNumber: internalSaleNumber.internalNumber,
        internalPeriod: internalSaleNumber.internalPeriod,
        subtotal,
        total,
        discountTotal,
        surchargeTotal,
        status: SaleStatus.PAID,
        customerId,
        cashSessionId: cashSession?.id ?? null,
        clientOperationId: offline?.clientOperationId ?? null,
        occurredAt,
        offlineSyncedAt: offline ? new Date() : null,
        items: {
          create: saleItems.map((item) => item.data)
        },
        payments: {
          create: paymentRecords
        }
      },
      include: {
        items: true,
        payments: true,
        user: true
      }
    });

    for (const item of saleItems) {
      if (item.isManual || !item.product) {
        continue;
      }
      const previousStock = item.product.stock;
      const newStock = previousStock.minus(item.quantity);

      await tx.product.update({
        where: { id: item.product.id },
        data: { stock: newStock }
      });

      await tx.stockMovement.create({
        data: {
          businessId: user.businessId!,
          productId: item.product.id,
          type: StockMovementType.SALE,
          quantity: item.quantity.negated(),
          previousStock,
          newStock,
          referenceId: sale.id,
          userId: user.id,
          reason: `Venta #${formatInternalSaleNumber(sale)}`
        }
      });
    }

    if (
      offline &&
      lateCashSession &&
      cashSession &&
      cashSession.countedCashAmount !== null
    ) {
      const expectedBefore =
        cashSession.expectedCashAmount ?? cashSession.openingAmount;
      const expectedAfter = expectedBefore.plus(total).toDecimalPlaces(2);
      await tx.cashSession.update({
        where: { id: cashSession.id },
        data: {
          expectedCashAmount: expectedAfter,
          differenceAmount: cashSession.countedCashAmount.minus(expectedAfter).toDecimalPlaces(2)
        }
      });
    }

    if (customerId && currentAccountTotal.gt(0)) {
      await createCustomerAccountMovement(tx, {
        customerId,
        saleId: sale.id,
        type: CustomerAccountMovementType.DEBIT,
        amount: currentAccountTotal,
        reason: `Venta #${formatInternalSaleNumber(sale)} a cuenta corriente`,
        paymentMethod: PaymentMethod.CURRENT_ACCOUNT,
        userId: user.id
      });
    }

    for (const payment of paymentRecords) {
      if (payment.paymentAttemptId) {
        const attempt = approvedAttemptsById.get(payment.paymentAttemptId);
        let extraDetail = {};
        if (attempt && attempt.amount && !attempt.amount.equals(payment.amount)) {
          const diff = attempt.amount.minus(payment.amount);
          const detailMsg = `[Monto dif] Real: ${attempt.amount}, Aplicado: ${payment.amount}, Dif: ${diff}`;
          const currentAttempt = await tx.paymentAttempt.findUnique({
            where: { id: payment.paymentAttemptId },
            select: { rawStatusDetail: true }
          });
          const newDetail = currentAttempt?.rawStatusDetail
            ? `${currentAttempt.rawStatusDetail} | ${detailMsg}`.slice(0, 190)
            : detailMsg.slice(0, 190);
          extraDetail = { rawStatusDetail: newDetail };
        }

        await tx.paymentAttempt.update({
          where: { id: payment.paymentAttemptId },
          data: {
            saleId: sale.id,
            ...extraDetail
          }
        });
      }
    }

    await applyFiscalDecisionToSale(tx, sale.id, fiscalDecision, user.id);

    const confirmedSale = await tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: {
        items: true,
        payments: true,
        user: true
      }
    });

    return { ...confirmedSale, offlineSyncLate: lateCashSession };
  });
  } catch (error) {
    if (offline && isUniqueClientOperationError(error)) {
      const existingSale = await prisma.sale.findFirst({
        where: {
          businessId: user.businessId!,
          clientOperationId: offline.clientOperationId
        },
        include: { items: true, payments: true, user: true }
      });
      if (existingSale) {
        return { ...existingSale, offlineSyncLate: false };
      }
    }
    throw error;
  }
}

function validateOfflineInput(
  offline: NonNullable<ConfirmSaleInput["offline"]>,
  user: { id: string; businessId: string | null }
) {
  if (!user.businessId || offline.businessId !== user.businessId || offline.userId !== user.id) {
    throw new OfflineSaleSyncError(
      "La venta offline no corresponde a la sesion autenticada.",
      "OFFLINE_CONTEXT_MISMATCH",
      false
    );
  }

  if (!offline.clientOperationId || offline.clientOperationId.length > 191) {
    throw new OfflineSaleSyncError(
      "La operacion offline no tiene un identificador valido.",
      "OFFLINE_OPERATION_INVALID",
      false
    );
  }

  if (
    Number.isNaN(offline.occurredAt.getTime()) ||
    offline.occurredAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    throw new OfflineSaleSyncError(
      "La fecha de la venta offline no es valida.",
      "OFFLINE_OCCURRED_AT_INVALID",
      false
    );
  }
}

function validateOfflineCashSession(
  cashSession: {
    id: string;
    status: CashSessionStatus;
    openedAt: Date;
    closedAt: Date | null;
  } | null,
  occurredAt: Date
) {
  if (!cashSession) {
    throw new OfflineSaleSyncError(
      "La caja original de esta venta no existe o no pertenece al comercio actual.",
      "OFFLINE_CASH_SESSION_NOT_FOUND"
    );
  }

  if (occurredAt < cashSession.openedAt) {
    throw new OfflineSaleSyncError(
      "La venta ocurrio antes de la apertura de la caja original.",
      "OFFLINE_CASH_SESSION_WINDOW_INVALID"
    );
  }

  if (cashSession.status === CashSessionStatus.OPEN) {
    return false;
  }

  if (cashSession.closedAt && occurredAt <= cashSession.closedAt) {
    return true;
  }

  throw new OfflineSaleSyncError(
    "La venta no corresponde al periodo de la caja original. Quedo pendiente para revision.",
    "OFFLINE_CASH_SESSION_WINDOW_INVALID"
  );
}

function isUniqueClientOperationError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function buildPaymentRecords(
  payments: PaymentInput[],
  subtotal: Prisma.Decimal,
  activeCreditPlans: ActiveCreditInstallmentPlan[],
  approvedAttemptsById: Map<
    string,
    { id: string; providerPaymentId: string | null; method: PaymentMethod; amount: Prisma.Decimal }
  >
) {
  const creditPayments = payments.filter((payment) => payment.method === PaymentMethod.CREDIT);
  if (creditPayments.length > 1) {
    throw new Error("Solo se permite un pago con crédito por venta.");
  }

  let surchargeTotal = new Prisma.Decimal(0);
  let creditInstallments: number | null = null;
  let creditSurchargeRate: Prisma.Decimal | null = null;
  let creditSurchargeAmount: Prisma.Decimal | null = null;

  if (creditPayments.length === 1) {
    creditInstallments = Number(creditPayments[0].installments ?? 1);
    const plan = activeCreditPlans.find(
      (option) => option.installments === creditInstallments
    );
    if (!plan) {
      throw new Error("Cantidad de cuotas inválida.");
    }

    creditSurchargeRate = new Prisma.Decimal(plan.surchargeRate);
    creditSurchargeAmount = subtotal
      .mul(creditSurchargeRate)
      .div(100)
      .toDecimalPlaces(2);
    surchargeTotal = creditSurchargeAmount;
  }

  const paymentRecords = payments.map((payment) => {
    const amount = new Prisma.Decimal(payment.amount).toDecimalPlaces(2);
    if (amount.lte(0)) {
      throw new Error("El importe del pago debe ser mayor a cero.");
    }

    if (payment.method === PaymentMethod.CREDIT) {
      return {
        method: payment.method,
        amount,
        receivedAmount: null,
        changeAmount: null,
        installments: creditInstallments,
        surchargeRate: creditSurchargeRate,
        surchargeAmount: creditSurchargeAmount,
        externalId: payment.externalId,
        externalReference: payment.externalReference,
        providerStatus: payment.providerStatus,
        paymentAttemptId: payment.paymentAttemptId ?? null
      };
    }

    if (payment.method === PaymentMethod.CASH) {
      const receivedAmount =
        payment.receivedAmount === undefined
          ? amount
          : new Prisma.Decimal(payment.receivedAmount).toDecimalPlaces(2);

      if (receivedAmount.lt(amount)) {
        throw new Error("El monto recibido no puede ser menor al importe aplicado.");
      }

      return {
        method: payment.method,
        amount,
        receivedAmount,
        changeAmount: receivedAmount.minus(amount).toDecimalPlaces(2),
        installments: null,
        surchargeRate: null,
        surchargeAmount: null,
        externalId: payment.externalId,
        externalReference: payment.externalReference,
        providerStatus: payment.providerStatus,
        paymentAttemptId: payment.paymentAttemptId ?? null
      };
    }

    const approvedAttempt = payment.paymentAttemptId
      ? approvedAttemptsById.get(payment.paymentAttemptId)
      : null;

    const receivedAmount = approvedAttempt ? approvedAttempt.amount : null;
    const changeAmount = (approvedAttempt && receivedAmount)
      ? receivedAmount.minus(amount).toDecimalPlaces(2)
      : null;

    return {
      method: payment.method,
      amount,
      receivedAmount,
      changeAmount,
      installments: null,
      surchargeRate: null,
      surchargeAmount: null,
      externalId: payment.externalId ?? approvedAttempt?.providerPaymentId,
      externalReference: payment.externalReference,
      providerStatus: payment.providerStatus,
      paymentAttemptId: payment.paymentAttemptId ?? null
    };
  });

  return {
    paymentRecords,
    surchargeTotal: surchargeTotal.toDecimalPlaces(2)
  };
}

async function validatePaymentAttempts(
  tx: Prisma.TransactionClient,
  payments: PaymentInput[]
) {
  const attemptIds = [
    ...new Set(payments.map((payment) => payment.paymentAttemptId).filter(Boolean))
  ] as string[];
  const approvedAttemptsById = new Map<
    string,
    { id: string; providerPaymentId: string | null; method: PaymentMethod; amount: Prisma.Decimal }
  >();

  if (attemptIds.length === 0) {
    return approvedAttemptsById;
  }

  const attempts = await tx.paymentAttempt.findMany({
    where: { id: { in: attemptIds } },
    include: { payment: { select: { id: true } } }
  });
  const attemptsById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const providerPaymentIds = [
    ...new Set(
      attempts
        .map((attempt) => attempt.providerPaymentId)
        .filter((value): value is string => Boolean(value))
    )
  ];
  const alreadyUsedProviderPayments =
    providerPaymentIds.length > 0
      ? await tx.paymentAttempt.findMany({
          where: {
            provider: PaymentProvider.MERCADOPAGO,
            providerPaymentId: { in: providerPaymentIds },
            id: { notIn: attemptIds },
            payment: { isNot: null }
          },
          select: { providerPaymentId: true }
        })
      : [];
  const usedProviderPaymentIds = new Set(
    alreadyUsedProviderPayments
      .map((attempt) => attempt.providerPaymentId)
      .filter((value): value is string => Boolean(value))
  );

  for (const payment of payments) {
    if (!payment.paymentAttemptId) {
      continue;
    }

    const attempt = attemptsById.get(payment.paymentAttemptId);
    if (!attempt || attempt.status !== "APPROVED") {
      throw new Error("El intento de Mercado Pago todavia no esta aprobado.");
    }
    if (attempt.payment) {
      throw new Error("Ese pago de Mercado Pago ya fue usado en otra venta.");
    }
    if (attempt.providerPaymentId && usedProviderPaymentIds.has(attempt.providerPaymentId)) {
      throw new Error("Ese pago de Mercado Pago ya fue usado en otra venta.");
    }
    const paymentAmount = new Prisma.Decimal(payment.amount).toDecimalPlaces(2);
    if (paymentAmount.gt(attempt.amount)) {
      throw new Error("El importe a aplicar no puede superar el monto de la transferencia.");
    }
    if (attempt.method !== payment.method) {
      throw new Error("El metodo de pago no coincide con la verificacion aplicada.");
    }

    approvedAttemptsById.set(attempt.id, {
      id: attempt.id,
      providerPaymentId: attempt.providerPaymentId,
      method: attempt.method,
      amount: attempt.amount
    });
  }

  return approvedAttemptsById;
}

function groupSaleItems(items: SaleItemInput[]) {
  const grouped = new Map<string, Prisma.Decimal>();

  for (const item of items) {
    if (!item.productId) continue;
    const quantity = new Prisma.Decimal(item.quantity);
    grouped.set(
      item.productId,
      (grouped.get(item.productId) ?? new Prisma.Decimal(0)).plus(quantity)
    );
  }

  return [...grouped.entries()].map(([productId, quantity]) => ({
    productId,
    quantity
  }));
}

function requiresServerReference(method: PaymentMethod, askReference: boolean | undefined) {
  const methodsRequiringReference = new Set<PaymentMethod>([
    PaymentMethod.DEBIT,
    PaymentMethod.CREDIT,
    PaymentMethod.TRANSFER,
    PaymentMethod.MERCADOPAGO
  ]);

  return (
    Boolean(askReference) && methodsRequiringReference.has(method)
  );
}

function normalizeOptionalPaymentText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 180) : undefined;
}
