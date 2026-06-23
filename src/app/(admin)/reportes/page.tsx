import { PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCustomerBalanceMap } from "@/lib/customer-account";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatStock } from "@/lib/stock-format";

export const dynamic = "force-dynamic";

type ReportesPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    method?: string;
  }>;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const from = params.from ?? dateInput(daysAgo(7));
  const to = params.to ?? dateInput(new Date());
  const method = parsePaymentMethod(params.method);
  const today = dateInput(new Date());
  const quickRanges = [
    { label: "Hoy", href: `/reportes?from=${today}&to=${today}` },
    {
      label: "Esta semana",
      href: `/reportes?from=${dateInput(startOfCurrentWeek())}&to=${today}`
    },
    {
      label: "Este mes",
      href: `/reportes?from=${dateInput(startOfCurrentMonth())}&to=${today}`
    }
  ];
  const dateWhere = {
    gte: startOfDay(from),
    lt: nextDay(to)
  };
  const saleWhere = {
    status: SaleStatus.PAID,
    createdAt: dateWhere,
    ...(method ? { payments: { some: { method } } } : {})
  } satisfies Prisma.SaleWhereInput;

  const [sales, cancelledSales, stockLowProducts, recentSales, purchases, customers] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      include: {
        payments: true,
        items: {
          include: {
            product: {
              select: { cost: true }
            }
          }
        }
      }
    }),
    prisma.sale.findMany({
      where: {
        status: SaleStatus.CANCELLED,
        createdAt: dateWhere
      },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        active: true
      },
      include: {
        category: { select: { name: true } }
      },
      orderBy: { stock: "asc" }
    }),
    prisma.sale.findMany({
      where: {
        createdAt: dateWhere
      },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.purchase.findMany({
      where: {
        createdAt: dateWhere
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.customer.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true }
    })
  ]);

  const lowProducts = stockLowProducts
    .filter((product) => product.stock.lte(product.minStock))
    .slice(0, 12);
  const metrics = buildMetrics(sales, cancelledSales);
  const topProducts = buildTopProducts(sales);
  const customerBalances = await getCustomerBalanceMap(customers.map((customer) => customer.id));
  const allDebtors = customers
    .map((customer) => ({
      ...customer,
      balance: customerBalances.get(customer.id) ?? new Prisma.Decimal(0)
    }))
    .filter((customer) => customer.balance.gt(0))
    .sort((left, right) => right.balance.comparedTo(left.balance));
  const debtors = allDebtors.slice(0, 8);
  const pendingCustomerBalance = allDebtors.reduce(
    (sum, customer) => sum.plus(customer.balance),
    new Prisma.Decimal(0)
  );
  const purchaseTotal = purchases.reduce(
    (sum, purchase) => sum.plus(purchase.total),
    new Prisma.Decimal(0)
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="Reportes"
        description="Resumen real de ventas, pagos, anulaciones y productos."
        actions={
          <>
            {quickRanges.map((range) => (
              <LinkButton key={range.label} href={range.href} size="sm">
                {range.label}
              </LinkButton>
            ))}
          </>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_220px_auto]">
          <Input name="from" type="date" defaultValue={from} />
          <Input name="to" type="date" defaultValue={to} />
          <Select name="method" defaultValue={method ?? ""}>
            <option value="">Todos los pagos</option>
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total vendido" value={formatARS(metrics.totalSold)} />
          <Metric label="Cantidad ventas" value={String(metrics.salesCount)} />
          <Metric label="Ticket promedio" value={formatARS(metrics.averageTicket)} />
          <Metric label="Total anuladas" value={formatARS(metrics.cancelledTotal)} tone="red" />
        </div>

        <MetricSection title="Medios de pago">
          <Metric label="Efectivo" value={formatARS(metrics.payments.CASH)} compact />
          <Metric label="Debito" value={formatARS(metrics.payments.DEBIT)} compact />
          <Metric label="Credito" value={formatARS(metrics.payments.CREDIT)} compact />
          <Metric label="Transferencia" value={formatARS(metrics.payments.TRANSFER)} compact />
          <Metric label="MercadoPago" value={formatARS(metrics.payments.MERCADOPAGO)} compact />
          <Metric
            label="Cuenta corriente"
            value={formatARS(metrics.payments.CURRENT_ACCOUNT)}
            compact
          />
        </MetricSection>

        <MetricSection title="Totales complementarios" columns="xl:grid-cols-3">
          <Metric label="Recargos" value={formatARS(metrics.surcharges)} compact />
          <Metric label="Descuentos" value={formatARS(metrics.discounts)} compact />
          <Metric label="Ganancia estimada" value={formatARS(metrics.estimatedProfit)} compact />
        </MetricSection>

        <MetricSection title="Cuenta corriente y compras" columns="xl:grid-cols-3">
          <Metric
            label="Ventas a cuenta corriente"
            value={formatARS(metrics.payments.CURRENT_ACCOUNT)}
            compact
          />
          <Metric label="Saldos pendientes" value={formatARS(pendingCustomerBalance)} compact />
          <Metric label="Compras del periodo" value={formatARS(purchaseTotal)} compact />
        </MetricSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportTable title="Productos mas vendidos">
          {topProducts.length === 0 ? (
            <EmptyLine text="Sin ventas en el periodo." />
          ) : (
            topProducts.map((product) => (
              <Row key={product.name} left={product.name} right={formatARS(product.total)} />
            ))
          )}
        </ReportTable>

        <ReportTable title="Productos con stock bajo">
          {lowProducts.length === 0 ? (
            <EmptyLine text="No hay productos bajo minimo." />
          ) : (
            lowProducts.map((product) => (
              <Row
                key={product.id}
                left={`${product.name} - ${product.category.name}`}
                right={formatStock(product.stock, product.unitType)}
              />
            ))
          )}
        </ReportTable>

        <ReportTable title="Ventas recientes">
          {recentSales.length === 0 ? (
            <EmptyLine text="Sin ventas recientes." />
          ) : (
            recentSales.map((sale) => (
              <Row
                key={sale.id}
                left={`#${sale.saleNumber} - ${sale.user.name}`}
                right={formatARS(sale.total)}
                badge={sale.status === SaleStatus.CANCELLED ? "Anulada" : "Pagada"}
              />
            ))
          )}
        </ReportTable>

        <ReportTable title="Ventas anuladas">
          {cancelledSales.length === 0 ? (
            <EmptyLine text="Sin anulaciones en el periodo." />
          ) : (
            cancelledSales.map((sale) => (
              <Row
                key={sale.id}
                left={`#${sale.saleNumber} - ${sale.user.name}`}
                right={formatARS(sale.total)}
                badge="Anulada"
              />
            ))
          )}
        </ReportTable>

        <ReportTable title="Clientes con mayor deuda">
          {debtors.length === 0 ? (
            <EmptyLine text="Sin saldos pendientes." />
          ) : (
            debtors.map((customer) => (
              <Row
                key={customer.id}
                left={customer.name}
                right={formatARS(customer.balance)}
              />
            ))
          )}
        </ReportTable>

        <ReportTable title="Compras recientes">
          {purchases.length === 0 ? (
            <EmptyLine text="Sin compras en el periodo." />
          ) : (
            purchases.map((purchase) => (
              <Row
                key={purchase.id}
                left={`#${purchase.purchaseNumber}`}
                right={formatARS(purchase.total)}
              />
            ))
          )}
        </ReportTable>
      </div>
    </section>
  );
}

function buildMetrics(
  sales: Array<{
    total: Prisma.Decimal;
    surchargeTotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    payments: Array<{ method: PaymentMethod; amount: Prisma.Decimal }>;
    items: Array<{
      subtotal: Prisma.Decimal;
      quantity: Prisma.Decimal;
      product: { cost: Prisma.Decimal | null };
    }>;
  }>,
  cancelledSales: Array<{ total: Prisma.Decimal }>
) {
  const payments = Object.fromEntries(
    Object.values(PaymentMethod).map((paymentMethod) => [paymentMethod, new Prisma.Decimal(0)])
  ) as Record<PaymentMethod, Prisma.Decimal>;
  let estimatedProfit = new Prisma.Decimal(0);

  for (const sale of sales) {
    for (const payment of sale.payments) {
      payments[payment.method] = payments[payment.method].plus(payment.amount);
    }

    for (const item of sale.items) {
      const cost = item.product.cost;
      if (cost) {
        estimatedProfit = estimatedProfit.plus(item.subtotal.minus(cost.mul(item.quantity)));
      }
    }
  }

  const totalSold = sum(sales.map((sale) => sale.total));
  const salesCount = sales.length;

  return {
    totalSold,
    salesCount,
    averageTicket: salesCount > 0 ? totalSold.div(salesCount).toDecimalPlaces(2) : 0,
    cancelledTotal: sum(cancelledSales.map((sale) => sale.total)),
    payments,
    surcharges: sum(sales.map((sale) => sale.surchargeTotal)),
    discounts: sum(sales.map((sale) => sale.discountTotal)),
    estimatedProfit
  };
}

function buildTopProducts(
  sales: Array<{ items: Array<{ productNameSnapshot: string; quantity: Prisma.Decimal; subtotal: Prisma.Decimal }> }>
) {
  const products = new Map<string, { name: string; quantity: Prisma.Decimal; total: Prisma.Decimal }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const current = products.get(item.productNameSnapshot) ?? {
        name: item.productNameSnapshot,
        quantity: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0)
      };
      current.quantity = current.quantity.plus(item.quantity);
      current.total = current.total.plus(item.subtotal);
      products.set(item.productNameSnapshot, current);
    }
  }

  return [...products.values()]
    .sort((left, right) => right.total.comparedTo(left.total))
    .slice(0, 10);
}

function Metric({
  label,
  value,
  tone,
  compact = false
}: {
  label: string;
  value: string;
  tone?: "red";
  compact?: boolean;
}) {
  return (
    <Card className={compact ? "min-w-0 p-4" : "min-w-0 p-4 2xl:p-5"}>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={tone === "red" ? "mt-2 break-words text-xl font-semibold text-red-700 dark:text-red-300 2xl:text-2xl" : "mt-2 break-words text-xl font-semibold text-gray-950 dark:text-gray-50 2xl:text-2xl"}>
        {value}
      </p>
    </Card>
  );
}

function MetricSection({
  title,
  children,
  columns = "xl:grid-cols-6"
}: {
  title: string;
  children: React.ReactNode;
  columns?: string;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
      <div className={`grid gap-3 md:grid-cols-2 ${columns}`}>{children}</div>
    </div>
  );
}

function ReportTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
      <div className="mt-4 divide-y divide-gray-100 dark:divide-neutral-800">{children}</div>
    </Card>
  );
}

function Row({
  left,
  right,
  badge
}: {
  left: string;
  right: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium text-gray-950 dark:text-gray-50">{left}</span>
        {badge ? (
          <span className="ml-2">
            <Badge tone={badge === "Anulada" ? "red" : "green"}>{badge}</Badge>
          </span>
        ) : null}
      </div>
      <span className="shrink-0 text-gray-700 dark:text-gray-200">{right}</span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{text}</p>;
}

function sum(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
}

function parsePaymentMethod(value: string | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(PaymentMethod).includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
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

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function nextDay(value: string) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}
