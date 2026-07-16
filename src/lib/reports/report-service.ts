import {
  CustomerAccountMovementType,
  PaymentMethod,
  Prisma,
  PurchaseStatus,
  SaleStatus,
  type UnitType
} from "@prisma/client";
import { fallbackPaymentLabels } from "@/lib/payment-display";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { prisma } from "@/lib/prisma";
import { formatInternalSaleNumber } from "@/lib/sale-numbering";

export type ReportFilters = {
  from: string;
  to: string;
  method: PaymentMethod | null;
};

export type Comparison = {
  previousValue: Prisma.Decimal | number | null;
  absolute: Prisma.Decimal | number | null;
  percent: number | null;
  direction: "up" | "down" | "flat" | "none";
};

export type ReportMetric = {
  value: Prisma.Decimal | number;
  comparison: Comparison;
};

export type ReportDashboardData = {
  filters: ReportFilters;
  quickRanges: Array<{ label: string; href: string }>;
  periodLabel: string;
  previousPeriodLabel: string;
  executive: {
    netSold: ReportMetric;
    grossSold: Prisma.Decimal;
    cancelledTotal: Prisma.Decimal;
    estimatedProfit: ReportMetric;
    marginPercent: ReportMetric;
    paidSalesCount: ReportMetric;
    cancelledSalesCount: number;
    cancellationRate: number;
    averageTicket: ReportMetric;
    itemsSold: Prisma.Decimal;
    unitsSold: Prisma.Decimal;
    bestPaymentMethod: PaymentMethod | null;
    topProductByRevenue: string | null;
    topProductByQuantity: string | null;
    topProductByProfit: string | null;
    leadingCategory: string | null;
    currentAccountSales: Prisma.Decimal;
    pendingCustomerBalance: Prisma.Decimal;
    purchasesTotal: Prisma.Decimal;
    salesMinusPurchases: Prisma.Decimal;
  };
  paymentBreakdown: PaymentBreakdownItem[];
  paymentLabels: Record<PaymentMethod, string>;
  dailySales: DailySalesItem[];
  topProductsByRevenue: ProductReportItem[];
  topProductsByQuantity: ProductReportItem[];
  topProductsByProfit: ProductReportItem[];
  lowStockProducts: LowStockProductItem[];
  categories: CategoryReportItem[];
  cashiers: CashierReportItem[];
  recentSales: RecentSaleItem[];
  recentCancelledSales: RecentSaleItem[];
  debtors: DebtorReportItem[];
  accountPaymentsTotal: Prisma.Decimal;
  purchases: PurchaseReportItem[];
  suppliers: SupplierReportItem[];
  mercadoPagoAttempts: MercadoPagoReportItem[];
  alerts: ReportAlert[];
};

export type PaymentBreakdownItem = {
  method: PaymentMethod;
  label: string;
  total: Prisma.Decimal;
  count: number;
  percent: number;
};

export type DailySalesItem = {
  date: string;
  label: string;
  total: Prisma.Decimal;
  count: number;
};

export type ProductReportItem = {
  productId: string;
  name: string;
  categoryName: string;
  quantity: Prisma.Decimal;
  revenue: Prisma.Decimal;
  estimatedProfit: Prisma.Decimal | null;
  missingCost: boolean;
};

export type LowStockProductItem = {
  id: string;
  name: string;
  categoryName: string;
  stock: Prisma.Decimal;
  minStock: Prisma.Decimal;
  unitType: UnitType;
};

export type CategoryReportItem = {
  categoryName: string;
  revenue: Prisma.Decimal;
  quantity: Prisma.Decimal;
  percent: number;
};

export type CashierReportItem = {
  userId: string;
  name: string;
  salesCount: number;
  total: Prisma.Decimal;
  cancelledCount: number;
};

export type RecentSaleItem = {
  id: string;
  internalSaleNumber: string;
  total: Prisma.Decimal;
  status: SaleStatus;
  createdAt: Date;
  userName: string;
  customerName: string;
};

export type DebtorReportItem = {
  id: string;
  name: string;
  balance: Prisma.Decimal;
};

export type PurchaseReportItem = {
  id: string;
  purchaseNumber: number;
  total: Prisma.Decimal;
  createdAt: Date;
  supplierName: string;
};

export type SupplierReportItem = {
  supplierId: string;
  name: string;
  total: Prisma.Decimal;
  count: number;
};

export type MercadoPagoReportItem = {
  id: string;
  saleId: string | null;
  internalSaleNumber: string | null;
  accountName: string;
  environment: string;
  amount: Prisma.Decimal;
  status: string;
  origin: string;
  externalReference: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  createdAt: Date;
};

export type ReportAlert = {
  title: string;
  description: string;
  severity: "info" | "warning" | "error";
  href?: string;
  actionLabel?: string;
};

const ZERO = new Prisma.Decimal(0);

export const reportPaymentLabels: Record<PaymentMethod, string> = {
  ...fallbackPaymentLabels
};

export function buildReportFilters(input: {
  from?: string;
  to?: string;
  method?: string;
}): ReportFilters {
  const today = formatDateInput(new Date());
  let from = isDateInput(input.from) ? input.from : formatDateInput(daysAgo(7));
  let to = isDateInput(input.to) ? input.to : today;

  if (from > to) {
    [from, to] = [to, from];
  }

  return {
    from,
    to,
    method: parsePaymentMethod(input.method)
  };
}

export function buildReportQuickRanges(method: PaymentMethod | null) {
  const today = formatDateInput(new Date());
  const ranges = [
    { label: "Hoy", from: today, to: today },
    { label: "Esta semana", from: formatDateInput(startOfCurrentWeek()), to: today },
    { label: "Este mes", from: formatDateInput(startOfCurrentMonth()), to: today }
  ];

  return ranges.map((range) => ({
    label: range.label,
    href: buildReportHref({ from: range.from, to: range.to, method })
  }));
}

export async function getReportDashboardData(
  filters: ReportFilters,
  businessId: string
): Promise<ReportDashboardData> {
  const period = buildPeriod(filters);
  const previousPeriod = buildPreviousPeriod(period);
  const saleWhere = buildSaleWhere(period, filters.method, SaleStatus.PAID, businessId);
  const cancelledWhere = buildSaleWhere(period, filters.method, SaleStatus.CANCELLED, businessId);
  const previousSaleWhere = buildSaleWhere(previousPeriod, filters.method, SaleStatus.PAID, businessId);
  const purchaseWhere = {
    status: PurchaseStatus.RECEIVED,
    createdAt: { gte: period.start, lt: period.end },
    businessId
  } satisfies Prisma.PurchaseWhereInput;

  const [
    sales,
    previousSales,
    cancelledSales,
    productsForAlerts,
    recentSales,
    purchases,
    customerMovements,
    accountPayments,
    paymentMethodSettings,
    mercadoPagoAttempts
  ] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { name: true, businessName: true } },
        payments: { select: { method: true, amount: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                cost: true,
                category: { select: { name: true } }
              }
            }
          }
        }
      }
    }),
    prisma.sale.findMany({
      where: previousSaleWhere,
      include: {
        items: {
          include: {
            product: { select: { cost: true } }
          }
        }
      }
    }),
    prisma.sale.findMany({
      where: cancelledWhere,
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { name: true, businessName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.product.findMany({
      where: { deletedAt: null, active: true, businessId },
      include: { category: { select: { name: true } } },
      orderBy: { stock: "asc" },
      take: 200
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: period.start, lt: period.end }, businessId },
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true, businessName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.purchase.findMany({
      where: purchaseWhere,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 25
    }),
    prisma.customerAccountMovement.findMany({
      where: {
        customer: { businessId }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            active: true,
            deletedAt: true
          }
        }
      }
    }),
    prisma.customerAccountMovement.findMany({
      where: {
        type: CustomerAccountMovementType.PAYMENT,
        createdAt: { gte: period.start, lt: period.end },
        customer: { businessId }
      },
      select: { amount: true }
    }),
    getPaymentMethodSettings(businessId),
    prisma.paymentAttempt.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
        businessId,
        ...(filters.method ? { method: filters.method } : {})
      },
      include: {
        mercadoPagoAccount: {
          select: {
            name: true,
            environment: true
          }
        },
        sale: {
          select: {
            id: true,
            internalNumber: true,
            internalPeriod: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);
  const paymentLabels = {
    ...reportPaymentLabels,
    ...Object.fromEntries(
      paymentMethodSettings.map((setting) => [setting.method, setting.label])
    )
  } as Record<PaymentMethod, string>;

  const currentMetrics = summarizeSales(sales);
  const previousMetrics = summarizeSales(previousSales);
  const cancelledTotal = sum(cancelledSales.map((sale) => sale.total));
  const paidSalesCount = sales.length;
  const cancelledSalesCount = cancelledSales.length;
  const grossSold = currentMetrics.totalSold.plus(cancelledTotal);
  const cancellationRate =
    paidSalesCount + cancelledSalesCount > 0
      ? (cancelledSalesCount / (paidSalesCount + cancelledSalesCount)) * 100
      : 0;
  const paymentBreakdown = buildPaymentBreakdown(
    sales,
    currentMetrics.totalSold,
    paymentLabels
  );
  const products = buildProductReports(sales);
  const categories = buildCategoryReports(products, currentMetrics.totalSold);
  const lowStockProducts = productsForAlerts
    .filter((product) => product.stock.lte(product.minStock))
    .slice(0, 10)
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryName: product.category.name,
      stock: product.stock,
      minStock: product.minStock,
      unitType: product.unitType
    }));
  const cashiers = buildCashierReports(sales, cancelledSales);
  const debtors = buildDebtors(customerMovements);
  const pendingCustomerBalance = sum(debtors.map((debtor) => debtor.balance));
  const accountPaymentsTotal = sum(accountPayments.map((movement) => movement.amount));
  const purchasesTotal = sum(purchases.map((purchase) => purchase.total));
  const suppliers = buildSupplierReports(purchases);
  const recentSaleItems = recentSales.map((sale) => ({
    id: sale.id,
    internalSaleNumber: formatInternalSaleNumber(sale),
    total: sale.total,
    status: sale.status,
    createdAt: sale.createdAt,
    userName: sale.user.name,
    customerName: sale.customer?.businessName ?? sale.customer?.name ?? "Consumidor final"
  }));
  const recentCancelledSales = cancelledSales.map((sale) => ({
    id: sale.id,
    internalSaleNumber: formatInternalSaleNumber(sale),
    total: sale.total,
    status: sale.status,
    createdAt: sale.createdAt,
    userName: sale.user.name,
    customerName: sale.customer?.businessName ?? sale.customer?.name ?? "Consumidor final"
  }));
  const productsMissingCost = productsForAlerts.filter((product) => !product.cost).length;
  const productsMissingTax = productsForAlerts.filter(
    (product) => !product.taxTreatment
  ).length;
  const alerts = buildAlerts({
    lowStockCount: lowStockProducts.length,
    productsMissingCost,
    productsMissingTax,
    cancelledSalesCount,
    debtorCount: debtors.length,
    purchasesTotal
  });

  return {
    filters,
    quickRanges: buildReportQuickRanges(filters.method),
    periodLabel: formatPeriodLabel(period.start, period.end),
    previousPeriodLabel: formatPeriodLabel(previousPeriod.start, previousPeriod.end),
    executive: {
      netSold: metric(currentMetrics.totalSold, previousMetrics.totalSold),
      grossSold,
      cancelledTotal,
      estimatedProfit: metric(currentMetrics.estimatedProfit, previousMetrics.estimatedProfit),
      marginPercent: metric(currentMetrics.marginPercent, previousMetrics.marginPercent),
      paidSalesCount: metric(paidSalesCount, previousSales.length),
      cancelledSalesCount,
      cancellationRate,
      averageTicket: metric(currentMetrics.averageTicket, previousMetrics.averageTicket),
      itemsSold: new Prisma.Decimal(
        sales.reduce((count, sale) => count + sale.items.length, 0)
      ),
      unitsSold: currentMetrics.unitsSold,
      bestPaymentMethod: paymentBreakdown[0]?.method ?? null,
      topProductByRevenue: products.byRevenue[0]?.name ?? null,
      topProductByQuantity: products.byQuantity[0]?.name ?? null,
      topProductByProfit: products.byProfit[0]?.name ?? null,
      leadingCategory: categories[0]?.categoryName ?? null,
      currentAccountSales:
        paymentBreakdown.find((item) => item.method === PaymentMethod.CURRENT_ACCOUNT)
          ?.total ?? ZERO,
      pendingCustomerBalance,
      purchasesTotal,
      salesMinusPurchases: currentMetrics.totalSold.minus(purchasesTotal)
    },
    paymentBreakdown,
    paymentLabels,
    dailySales: buildDailySales(sales, period),
    topProductsByRevenue: products.byRevenue,
    topProductsByQuantity: products.byQuantity,
    topProductsByProfit: products.byProfit,
    lowStockProducts,
    categories,
    cashiers,
    recentSales: recentSaleItems,
    recentCancelledSales,
    debtors: debtors.slice(0, 8),
    accountPaymentsTotal,
    purchases: purchases.slice(0, 10).map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      total: purchase.total,
      createdAt: purchase.createdAt,
      supplierName: purchase.supplier?.name ?? "Sin proveedor"
    })),
    suppliers,
    mercadoPagoAttempts: mercadoPagoAttempts.map((attempt) => ({
      id: attempt.id,
      saleId: attempt.sale?.id ?? null,
      internalSaleNumber: attempt.sale ? formatInternalSaleNumber(attempt.sale) : null,
      accountName: attempt.mercadoPagoAccount.name,
      environment: attempt.mercadoPagoAccount.environment,
      amount: attempt.amount,
      status: attempt.status,
      origin: attempt.origin,
      externalReference: attempt.externalReference,
      providerOrderId: attempt.providerOrderId,
      providerPaymentId: attempt.providerPaymentId,
      createdAt: attempt.createdAt
    })),
    alerts
  };
}

function buildSaleWhere(
  period: { start: Date; end: Date },
  method: PaymentMethod | null,
  status: SaleStatus,
  businessId: string
): Prisma.SaleWhereInput {
  return {
    status,
    businessId,
    createdAt: { gte: period.start, lt: period.end },
    ...(method ? { payments: { some: { method } } } : {})
  };
}

function summarizeSales(
  sales: Array<{
    total: Prisma.Decimal;
    items: Array<{
      quantity: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      product: { cost: Prisma.Decimal | null } | null;
    }>;
  }>
) {
  const totalSold = sum(sales.map((sale) => sale.total));
  const estimatedProfit = sales.reduce((acc, sale) => {
    const saleProfit = sale.items.reduce((itemAcc, item) => {
      if (!item.product || !item.product.cost) {
        return itemAcc;
      }
      return itemAcc.plus(item.subtotal.minus(item.product.cost.mul(item.quantity)));
    }, ZERO);

    return acc.plus(saleProfit);
  }, ZERO);
  const unitsSold = sales.reduce(
    (acc, sale) =>
      acc.plus(sale.items.reduce((itemAcc, item) => itemAcc.plus(item.quantity), ZERO)),
    ZERO
  );
  const averageTicket =
    sales.length > 0 ? totalSold.div(sales.length).toDecimalPlaces(2) : ZERO;
  const marginPercent = totalSold.gt(0)
    ? estimatedProfit.div(totalSold).mul(100).toDecimalPlaces(1)
    : ZERO;

  return {
    totalSold,
    estimatedProfit,
    unitsSold,
    averageTicket,
    marginPercent
  };
}

function buildPaymentBreakdown(
  sales: Array<{ payments: Array<{ method: PaymentMethod; amount: Prisma.Decimal }> }>,
  totalSold: Prisma.Decimal,
  paymentLabels: Record<PaymentMethod, string>
) {
  const totals = new Map<PaymentMethod, { total: Prisma.Decimal; count: number }>();

  for (const method of Object.values(PaymentMethod)) {
    totals.set(method, { total: ZERO, count: 0 });
  }

  for (const sale of sales) {
    const saleMethods = new Set<PaymentMethod>();
    for (const payment of sale.payments) {
      const current = totals.get(payment.method) ?? { total: ZERO, count: 0 };
      current.total = current.total.plus(payment.amount);
      if (!saleMethods.has(payment.method)) {
        current.count += 1;
        saleMethods.add(payment.method);
      }
      totals.set(payment.method, current);
    }
  }

  return Object.values(PaymentMethod)
    .map((method) => {
      const current = totals.get(method) ?? { total: ZERO, count: 0 };
      return {
        method,
        label: paymentLabels[method],
        total: current.total,
        count: current.count,
        percent: totalSold.gt(0) ? current.total.div(totalSold).mul(100).toNumber() : 0
      };
    })
    .sort((left, right) => right.total.comparedTo(left.total));
}

function buildDailySales(
  sales: Array<{ createdAt: Date; total: Prisma.Decimal }>,
  period: { start: Date; end: Date }
) {
  const days = new Map<string, DailySalesItem>();
  const cursor = new Date(period.start);

  while (cursor < period.end) {
    const date = formatDateInput(cursor);
    days.set(date, {
      date,
      label: formatShortDate(cursor),
      total: ZERO,
      count: 0
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const sale of sales) {
    const key = formatDateInput(sale.createdAt);
    const current = days.get(key);
    if (!current) {
      continue;
    }
    current.total = current.total.plus(sale.total);
    current.count += 1;
  }

  return [...days.values()];
}

function buildProductReports(
  sales: Array<{
    items: Array<{
      productId: string | null;
      productNameSnapshot: string;
      quantity: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      product: {
        id: string;
        name: string;
        cost: Prisma.Decimal | null;
        category: { name: string };
      } | null;
    }>;
  }>
) {
  const map = new Map<string, ProductReportItem>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const idKey = item.productId ?? `manual_${item.productNameSnapshot}`;
      const current = map.get(idKey) ?? {
        productId: idKey,
        name: item.productId ? (item.productNameSnapshot || item.product?.name || "Sin nombre") : `Manual: ${item.productNameSnapshot}`,
        categoryName: item.product?.category?.name || "Artículo manual",
        quantity: ZERO,
        revenue: ZERO,
        estimatedProfit: ZERO,
        missingCost: false
      };

      current.quantity = current.quantity.plus(item.quantity);
      current.revenue = current.revenue.plus(item.subtotal);

      const cost = item.product?.cost ?? null;
      if (cost && !current.missingCost) {
        current.estimatedProfit = (current.estimatedProfit ?? ZERO).plus(
          item.subtotal.minus(cost.mul(item.quantity))
        );
      } else {
        current.estimatedProfit = null;
        current.missingCost = true;
      }
      map.set(idKey, current);
    }
  }

  const products = [...map.values()];

  return {
    all: products,
    byRevenue: [...products]
      .sort((left, right) => right.revenue.comparedTo(left.revenue))
      .slice(0, 8),
    byQuantity: [...products]
      .sort((left, right) => right.quantity.comparedTo(left.quantity))
      .slice(0, 8),
    byProfit: [...products]
      .filter((product) => product.estimatedProfit !== null)
      .sort((left, right) =>
        (right.estimatedProfit ?? ZERO).comparedTo(left.estimatedProfit ?? ZERO)
      )
      .slice(0, 8)
  };
}

function buildCategoryReports(
  products: { all: ProductReportItem[] },
  totalSold: Prisma.Decimal
) {
  const map = new Map<string, CategoryReportItem>();

  for (const product of products.all) {
    const current = map.get(product.categoryName) ?? {
      categoryName: product.categoryName,
      revenue: ZERO,
      quantity: ZERO,
      percent: 0
    };
    current.revenue = current.revenue.plus(product.revenue);
    current.quantity = current.quantity.plus(product.quantity);
    map.set(product.categoryName, current);
  }

  return [...map.values()]
    .map((category) => ({
      ...category,
      percent: totalSold.gt(0) ? category.revenue.div(totalSold).mul(100).toNumber() : 0
    }))
    .sort((left, right) => right.revenue.comparedTo(left.revenue))
    .slice(0, 8);
}

function buildCashierReports(
  sales: Array<{ user: { id: string; name: string }; total: Prisma.Decimal }>,
  cancelledSales: Array<{ user: { id: string; name: string } }>
) {
  const map = new Map<string, CashierReportItem>();

  for (const sale of sales) {
    const current = map.get(sale.user.id) ?? {
      userId: sale.user.id,
      name: sale.user.name,
      salesCount: 0,
      total: ZERO,
      cancelledCount: 0
    };
    current.salesCount += 1;
    current.total = current.total.plus(sale.total);
    map.set(sale.user.id, current);
  }

  for (const sale of cancelledSales) {
    const current = map.get(sale.user.id) ?? {
      userId: sale.user.id,
      name: sale.user.name,
      salesCount: 0,
      total: ZERO,
      cancelledCount: 0
    };
    current.cancelledCount += 1;
    map.set(sale.user.id, current);
  }

  return [...map.values()]
    .sort((left, right) => right.total.comparedTo(left.total))
    .slice(0, 8);
}

function buildDebtors(
  movements: Array<{
    type: CustomerAccountMovementType;
    amount: Prisma.Decimal;
    customer: { id: string; name: string; active: boolean; deletedAt: Date | null };
  }>
) {
  const map = new Map<string, DebtorReportItem>();

  for (const movement of movements) {
    if (!movement.customer.active || movement.customer.deletedAt) {
      continue;
    }
    const current = map.get(movement.customer.id) ?? {
      id: movement.customer.id,
      name: movement.customer.name,
      balance: ZERO
    };
    current.balance = current.balance.plus(signedAccountAmount(movement.type, movement.amount));
    map.set(movement.customer.id, current);
  }

  return [...map.values()]
    .filter((customer) => customer.balance.gt(0))
    .sort((left, right) => right.balance.comparedTo(left.balance));
}

function buildSupplierReports(
  purchases: Array<{ supplier: { id: string; name: string } | null; total: Prisma.Decimal }>
) {
  const map = new Map<string, SupplierReportItem>();

  for (const purchase of purchases) {
    const supplierId = purchase.supplier?.id ?? "unknown";
    const current = map.get(supplierId) ?? {
      supplierId,
      name: purchase.supplier?.name ?? "Sin proveedor",
      total: ZERO,
      count: 0
    };
    current.total = current.total.plus(purchase.total);
    current.count += 1;
    map.set(supplierId, current);
  }

  return [...map.values()]
    .sort((left, right) => right.total.comparedTo(left.total))
    .slice(0, 8);
}

function buildAlerts(input: {
  lowStockCount: number;
  productsMissingCost: number;
  productsMissingTax: number;
  cancelledSalesCount: number;
  debtorCount: number;
  purchasesTotal: Prisma.Decimal;
}): ReportAlert[] {
  const alerts: ReportAlert[] = [];

  if (input.lowStockCount > 0) {
    alerts.push({
      title: "Stock bajo",
      description: `${input.lowStockCount} productos estan en minimo o por debajo.`,
      severity: "warning",
      href: "/stock",
      actionLabel: "Ver stock"
    });
  }

  if (input.productsMissingCost > 0) {
    alerts.push({
      title: "Productos sin costo",
      description: `${input.productsMissingCost} productos no tienen costo cargado; la ganancia queda subestimada.`,
      severity: "warning",
      href: "/productos",
      actionLabel: "Ver productos"
    });
  }

  if (input.productsMissingTax > 0) {
    alerts.push({
      title: "Fiscal incompleto",
      description: `${input.productsMissingTax} productos heredan o no tienen tratamiento fiscal propio.`,
      severity: "info",
      href: "/productos",
      actionLabel: "Ver productos"
    });
  }

  if (input.cancelledSalesCount > 0) {
    alerts.push({
      title: "Ventas anuladas",
      description: `${input.cancelledSalesCount} anulaciones en el periodo seleccionado.`,
      severity: "error",
      href: "/ventas",
      actionLabel: "Ver ventas"
    });
  }

  if (input.debtorCount > 0) {
    alerts.push({
      title: "Deuda de clientes",
      description: `${input.debtorCount} clientes tienen saldo pendiente.`,
      severity: "warning",
      href: "/clientes",
      actionLabel: "Ver clientes"
    });
  }

  if (input.purchasesTotal.gt(0)) {
    alerts.push({
      title: "Compras del periodo",
      description: `Compras registradas por ${formatPlainMoney(input.purchasesTotal)}.`,
      severity: "info",
      href: "/compras",
      actionLabel: "Ver compras"
    });
  }

  return alerts.slice(0, 8);
}

function metric(
  current: Prisma.Decimal | number,
  previous: Prisma.Decimal | number
): ReportMetric {
  const currentDecimal = toDecimal(current);
  const previousDecimal = toDecimal(previous);
  const absolute = currentDecimal.minus(previousDecimal);
  const percent = previousDecimal.equals(0)
    ? null
    : absolute.div(previousDecimal).mul(100).toNumber();

  return {
    value: current,
    comparison: {
      previousValue: previous,
      absolute,
      percent,
      direction: previousDecimal.equals(0)
        ? "none"
        : absolute.gt(0)
          ? "up"
          : absolute.lt(0)
            ? "down"
            : "flat"
    }
  };
}

function buildPeriod(filters: ReportFilters) {
  const start = startOfDay(filters.from);
  const end = nextDay(filters.to);

  return { start, end };
}

function buildPreviousPeriod(period: { start: Date; end: Date }) {
  const duration = period.end.getTime() - period.start.getTime();

  return {
    start: new Date(period.start.getTime() - duration),
    end: new Date(period.start)
  };
}

function buildReportHref(filters: ReportFilters) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to
  });
  if (filters.method) {
    params.set("method", filters.method);
  }
  return `/reportes?${params.toString()}`;
}

function parsePaymentMethod(value: string | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(PaymentMethod).includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
}

function signedAccountAmount(type: CustomerAccountMovementType, amount: Prisma.Decimal) {
  if (
    type === CustomerAccountMovementType.PAYMENT ||
    type === CustomerAccountMovementType.SALE_CANCELLED
  ) {
    return amount.negated();
  }

  return amount;
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), ZERO);
}

function toDecimal(value: Prisma.Decimal | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function formatPlainMoney(value: Prisma.Decimal) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value.toNumber());
}

function formatPeriodLabel(start: Date, endExclusive: Date) {
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1);

  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function isDateInput(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function startOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function startOfCurrentMonth() {
  const date = new Date();
  date.setDate(1);
  return date;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function nextDay(value: string) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}
