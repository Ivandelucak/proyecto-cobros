import {
  CashSessionStatus,
  CustomerAccountMovementType,
  PaymentMethod,
  PaymentProvider,
  Prisma,
  Role,
  SaleStatus,
  StockMovementType
} from "@prisma/client";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { createCustomerAccountMovement } from "@/lib/customer-account";
import { applyFiscalDecisionToSale } from "@/lib/fiscal/fiscal-engine";
import { determineFiscalRequirementForSale } from "@/lib/fiscal/fiscal-policy";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import {
  getActiveCreditInstallmentPlans,
  getPaymentMethodSettings
} from "@/lib/payment-settings";
import { assertRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type SaleItemInput = {
  productId?: string | null;
  quantity: Prisma.Decimal.Value;
  isManual?: boolean;
  name?: string;
  unitPrice?: Prisma.Decimal.Value;
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
};

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

  return prisma.$transaction(async (tx) => {
    const cashSetting = await getCashRegisterSetting(user.businessId ?? undefined, tx);
    const cashSession = await tx.cashSession.findFirst({
      where: { status: CashSessionStatus.OPEN, businessId: user.businessId! },
      select: { id: true }
    });

    if (cashSetting.requireOpenSession && !cashSession) {
      throw new Error("No hay caja abierta para registrar la venta.");
    }

    const catalogItems = input.items.filter((item) => !item.isManual);
    const manualItems = input.items.filter((item) => item.isManual);

    const productIds = [...new Set(catalogItems.map((item) => item.productId as string))];
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        active: true,
        deletedAt: null
      }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    if (productsById.size !== productIds.length) {
      throw new Error("Uno o más productos no están disponibles.");
    }

    const groupedCatalogItems = groupSaleItems(catalogItems);
    let subtotal = new Prisma.Decimal(0);

    const catalogSaleItems = groupedCatalogItems.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new Error("Producto inválido.");
      }

      if (item.quantity.lte(0)) {
        throw new Error(`La cantidad de ${product.name} debe ser mayor a cero.`);
      }

      if (!product.allowsDecimalQuantity && !item.quantity.mod(1).equals(0)) {
        throw new Error(`${product.name} no permite cantidades decimales.`);
      }

      if (!cashSetting.allowNegativeStock && product.stock.lt(item.quantity)) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      const itemSubtotal = product.salePrice.mul(item.quantity).toDecimalPlaces(2);
      subtotal = subtotal.plus(itemSubtotal);

      return {
        product,
        quantity: item.quantity,
        isManual: false,
        data: {
          productId: product.id,
          productNameSnapshot: product.name,
          unitPrice: product.salePrice,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          unitTypeSnapshot: product.unitType,
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
    const fiscalDecision = determineFiscalRequirementForSale({
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

    const sale = await tx.sale.create({
      data: {
        businessId: user.businessId!,
        userId: user.id,
        subtotal,
        total,
        discountTotal,
        surchargeTotal,
        status: SaleStatus.PAID,
        customerId,
        cashSessionId: cashSession?.id ?? null,
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
          reason: `Venta #${sale.saleNumber}`
        }
      });
    }

    if (customerId && currentAccountTotal.gt(0)) {
      await createCustomerAccountMovement(tx, {
        customerId,
        saleId: sale.id,
        type: CustomerAccountMovementType.DEBIT,
        amount: currentAccountTotal,
        reason: `Venta #${sale.saleNumber} a cuenta corriente`,
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

    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: {
        items: true,
        payments: true,
        user: true
      }
    });
  });
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
