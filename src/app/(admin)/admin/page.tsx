import { Prisma, SaleStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";
import { getCustomerBalanceMap } from "@/lib/customer-account";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [cashSession, todaySales, stockLowProducts, latestSales, customers, latestPurchases] = await Promise.all([
    getOpenCashSessionSnapshot(),
    prisma.sale.findMany({
      where: {
        status: SaleStatus.PAID,
        createdAt: { gte: start, lt: end }
      },
      include: {
        items: true
      }
    }),
    prisma.product.findMany({
      where: {
        active: true,
        deletedAt: null
      },
      orderBy: { stock: "asc" }
    }),
    prisma.sale.findMany({
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.customer.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true }
    }),
    prisma.purchase.findMany({
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6
    })
  ]);

  const lowProducts = stockLowProducts
    .filter((product) => product.stock.lte(product.minStock))
    .slice(0, 8);
  const todayTotal = todaySales.reduce(
    (sum, sale) => sum.plus(sale.total),
    new Prisma.Decimal(0)
  );
  const customerBalances = await getCustomerBalanceMap(customers.map((customer) => customer.id));
  const pendingCustomerBalance = [...customerBalances.values()].reduce(
    (sum, balance) => sum.plus(balance.gt(0) ? balance : 0),
    new Prisma.Decimal(0)
  );
  const topProducts = buildTopProducts(todaySales);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Panel admin"
        description="Metricas operativas del dia, caja actual y alertas simples."
        actions={<LinkButton href="/caja" variant="primary">Ir a caja</LinkButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ventas de hoy" value={formatARS(todayTotal)} />
        <Metric
          label="Caja"
          value={cashSession ? "Abierta" : "Cerrada"}
          detail={cashSession ? `Esperado ${formatARS(cashSession.summary.expectedCash)}` : "Sin caja abierta"}
        />
        <Metric label="Stock bajo" value={String(lowProducts.length)} />
        <Metric label="Cuentas corrientes" value={formatARS(pendingCustomerBalance)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Ultimas ventas
          </h2>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-neutral-800">
            {latestSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-950 dark:text-gray-50">
                    Venta #{sale.saleNumber}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {sale.user.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-950 dark:text-gray-50">
                    {formatARS(sale.total)}
                  </p>
                  <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                    {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Productos mas vendidos hoy
          </h2>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-neutral-800">
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sin ventas hoy.
              </p>
            ) : (
              topProducts.map((product) => (
                <div key={product.name} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="font-medium text-gray-950 dark:text-gray-50">
                    {product.name}
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {formatARS(product.total)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
            Compras recientes
          </h2>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-neutral-800">
            {latestPurchases.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sin compras registradas.
              </p>
            ) : (
              latestPurchases.map((purchase) => (
                <div key={purchase.id} className="flex justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-950 dark:text-gray-50">
                      Compra #{purchase.purchaseNumber}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {purchase.supplier?.name ?? "Sin proveedor"}
                    </p>
                  </div>
                  <span className="font-medium text-gray-950 dark:text-gray-50">
                    {formatARS(purchase.total)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-gray-950 dark:text-gray-50">{value}</p>
      {detail ? <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{detail}</p> : null}
    </Card>
  );
}

function buildTopProducts(
  sales: Array<{ items: Array<{ productNameSnapshot: string; subtotal: Prisma.Decimal }> }>
) {
  const products = new Map<string, { name: string; total: Prisma.Decimal }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const current = products.get(item.productNameSnapshot) ?? {
        name: item.productNameSnapshot,
        total: new Prisma.Decimal(0)
      };
      current.total = current.total.plus(item.subtotal);
      products.set(item.productNameSnapshot, current);
    }
  }

  return [...products.values()]
    .sort((left, right) => right.total.comparedTo(left.total))
    .slice(0, 8);
}
