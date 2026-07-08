import { PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { BarList } from "@/components/reports/bar-list";
import { DailySalesChart } from "@/components/reports/daily-sales-chart";
import { MetricCard } from "@/components/reports/metric-card";
import { ReportList, type ReportListItem } from "@/components/reports/report-list";
import { ReportSection } from "@/components/reports/report-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOperationalUser } from "@/lib/admin-auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import {
  buildReportFilters,
  getReportDashboardData,
  type ReportAlert
} from "@/lib/reports/report-service";
import { formatStock } from "@/lib/stock-format";

export const dynamic = "force-dynamic";

type ReportesPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    method?: string;
  }>;
};

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const user = await requireOperationalUser();

  const params = await searchParams;
  const filters = buildReportFilters(params);
  const data = await getReportDashboardData(filters, user.businessId!);
  const executive = data.executive;
  const paymentLabels = data.paymentLabels;
  const methodLabel = filters.method ? paymentLabels[filters.method] : "Todos los pagos";

  return (
    <section className="space-y-5">
      <PageHeader
        title="Reportes"
        description={`Dashboard comercial del periodo ${data.periodLabel}. Comparacion contra ${data.previousPeriodLabel}.`}
        actions={
          <>
            {data.quickRanges.map((range) => (
              <LinkButton key={range.label} href={range.href} size="sm" variant="outline">
                {range.label}
              </LinkButton>
            ))}
          </>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[160px_160px_minmax(190px,1fr)_auto]">
          <Input name="from" type="date" defaultValue={filters.from} aria-label="Desde" />
          <Input name="to" type="date" defaultValue={filters.to} aria-label="Hasta" />
          <Select name="method" defaultValue={filters.method ?? ""} aria-label="Medio de pago">
            <option value="">Todos los pagos</option>
            {Object.values(PaymentMethod).map((method) => (
              <option key={method} value={method}>
                {paymentLabels[method]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#7F8D9A]">
          <span>Periodo: {data.periodLabel}</span>
          <span className="hidden h-1 w-1 rounded-full bg-current sm:inline-block" />
          <span>Pago: {methodLabel}</span>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Venta neta"
          value={formatARS(executive.netSold.value)}
          detail="Ventas pagadas, sin anuladas."
          comparison={executive.netSold.comparison}
          tone="blue"
        />
        <MetricCard
          label="Ganancia estimada"
          value={formatARS(executive.estimatedProfit.value)}
          detail="Calculada con costos cargados."
          comparison={executive.estimatedProfit.comparison}
          tone="green"
        />
        <MetricCard
          label="Ticket promedio"
          value={formatARS(executive.averageTicket.value)}
          detail="Promedio por venta pagada."
          comparison={executive.averageTicket.comparison}
        />
        <MetricCard
          label="Ventas pagadas"
          value={formatInteger(executive.paidSalesCount.value)}
          detail={`${executive.cancelledSalesCount} anuladas`}
          comparison={executive.paidSalesCount.comparison}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Venta bruta"
          value={formatARS(executive.grossSold)}
          detail="Incluye ventas anuladas."
          compact
        />
        <MetricCard
          label="Total anulado"
          value={formatARS(executive.cancelledTotal)}
          detail={`${formatPercent(executive.cancellationRate)} de operaciones`}
          tone={executive.cancelledSalesCount > 0 ? "red" : "default"}
          compact
        />
        <MetricCard
          label="Margen estimado"
          value={formatPercentNumber(executive.marginPercent.value)}
          detail="Ganancia sobre venta neta."
          comparison={executive.marginPercent.comparison}
          compact
        />
        <MetricCard
          label="Unidades vendidas"
          value={formatDecimal(executive.unitsSold, 3)}
          detail={`${formatInteger(executive.itemsSold)} lineas de productos`}
          compact
        />
        <MetricCard
          label="Mejor medio"
          value={executive.bestPaymentMethod ? paymentLabels[executive.bestPaymentMethod] : "-"}
          detail="Por importe cobrado."
          compact
        />
        <MetricCard
          label="Categoria lider"
          value={executive.leadingCategory ?? "-"}
          detail="Por facturacion."
          compact
        />
        <MetricCard
          label="Ventas a cuenta"
          value={formatARS(executive.currentAccountSales)}
          detail="Operacion financiada a clientes."
          tone="amber"
          compact
        />
        <MetricCard
          label="Ventas - compras"
          value={formatARS(executive.salesMinusPurchases)}
          detail={`Compras: ${formatARS(executive.purchasesTotal)}`}
          tone={executive.salesMinusPurchases.lt(0) ? "red" : "green"}
          compact
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ReportSection
          title="Medios de pago"
          description="Distribucion del cobro por importe y cantidad de ventas."
        >
          <BarList
            emptyText="Sin cobros en el periodo."
            items={data.paymentBreakdown.map((item) => ({
              label: item.label,
              value: item.total.toNumber(),
              valueLabel: formatARS(item.total),
              detail: `${item.count} operaciones`,
              percentLabel: formatPercent(item.percent),
              tone: paymentTone(item.method)
            }))}
          />
        </ReportSection>

        <ReportSection
          title="Tendencia diaria"
          description="Ventas netas por dia dentro del rango seleccionado."
        >
          <DailySalesChart items={data.dailySales} />
        </ReportSection>
      </div>

      <ReportSection
        title="Mercado Pago API"
        description="Ordenes QR, matches por monto y referencias asociadas al periodo filtrado."
      >
        <ReportList
          dense
          emptyText="Sin operaciones Mercado Pago API en el periodo."
          items={data.mercadoPagoAttempts.map((attempt) => ({
            id: attempt.id,
            title: attempt.saleNumber
              ? `Venta #${attempt.saleNumber}`
              : `Intento ${attempt.id.slice(-6)}`,
            description: `${attempt.accountName} (${attempt.environment}) - ${paymentAttemptOriginLabel(
              attempt.origin
            )} - Ref. ${attempt.externalReference}`,
            value: formatARS(attempt.amount),
            badge: paymentAttemptStatusLabel(attempt.status),
            badgeTone: paymentAttemptTone(attempt.status),
            action: attempt.saleId ? (
              <LinkButton href={`/ventas/${attempt.saleId}`} size="sm" variant="outline">
                Ver venta
              </LinkButton>
            ) : null
          }))}
        />
      </ReportSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection title="Top productos por facturacion">
          <BarList
            emptyText="Sin productos vendidos en el periodo."
            items={data.topProductsByRevenue.map((product) => ({
              label: product.name,
              value: product.revenue.toNumber(),
              valueLabel: formatARS(product.revenue),
              detail: `${product.categoryName} - ${formatDecimal(product.quantity, 3)} u.`,
              tone: "blue"
            }))}
          />
        </ReportSection>

        <ReportSection title="Top productos por cantidad">
          <BarList
            emptyText="Sin productos vendidos en el periodo."
            items={data.topProductsByQuantity.map((product) => ({
              label: product.name,
              value: product.quantity.toNumber(),
              valueLabel: formatDecimal(product.quantity, 3),
              detail: `${product.categoryName} - ${formatARS(product.revenue)}`,
              tone: "green"
            }))}
          />
        </ReportSection>

        <ReportSection title="Top productos por ganancia">
          <BarList
            emptyText="Sin costos suficientes para estimar ganancia."
            items={data.topProductsByProfit.map((product) => ({
              label: product.name,
              value: product.estimatedProfit?.toNumber() ?? 0,
              valueLabel: product.estimatedProfit ? formatARS(product.estimatedProfit) : "-",
              detail: `${product.categoryName} - venta ${formatARS(product.revenue)}`,
              tone: "amber"
            }))}
          />
        </ReportSection>

        <ReportSection title="Stock bajo">
          <ReportList
            emptyText="No hay productos por debajo del minimo."
            items={data.lowStockProducts.map((product) => ({
              id: product.id,
              title: product.name,
              description: `${product.categoryName} - minimo ${formatStock(
                product.minStock,
                product.unitType
              )}`,
              value: formatStock(product.stock, product.unitType),
              badge: "Stock bajo",
              badgeTone: "amber"
            }))}
          />
        </ReportSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ReportSection title="Categorias" description="Participacion por categoria vendida.">
          <BarList
            emptyText="Sin ventas por categoria."
            items={data.categories.map((category) => ({
              label: category.categoryName,
              value: category.revenue.toNumber(),
              valueLabel: formatARS(category.revenue),
              detail: `${formatDecimal(category.quantity, 3)} unidades`,
              percentLabel: formatPercent(category.percent),
              tone: "blue"
            }))}
          />
        </ReportSection>

        <ReportSection title="Operacion y cajeros">
          <div className="grid gap-4 lg:grid-cols-2">
            <BarList
              emptyText="Sin ventas por cajero."
              items={data.cashiers.map((cashier) => ({
                label: cashier.name,
                value: cashier.total.toNumber(),
                valueLabel: formatARS(cashier.total),
                detail: `${cashier.salesCount} ventas - ${cashier.cancelledCount} anuladas`,
                tone: cashier.cancelledCount > 0 ? "amber" : "green"
              }))}
            />
            <ReportList
              dense
              emptyText="Sin ventas recientes."
              items={data.recentSales.map((sale) => saleListItem(sale))}
            />
          </div>
        </ReportSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportSection
          title="Clientes y cuenta corriente"
          description="Deuda vigente, ventas a cuenta y pagos recibidos."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Deuda clientes"
              value={formatARS(executive.pendingCustomerBalance)}
              detail={`${data.debtors.length} clientes visibles`}
              tone={executive.pendingCustomerBalance.gt(0) ? "amber" : "default"}
              compact
            />
            <MetricCard
              label="Ventas a cuenta"
              value={formatARS(executive.currentAccountSales)}
              detail="Del periodo filtrado."
              compact
            />
            <MetricCard
              label="Pagos recibidos"
              value={formatARS(data.accountPaymentsTotal)}
              detail="Cobros de cuenta corriente."
              compact
            />
          </div>
          <div className="mt-4">
            <BarList
              emptyText="No hay clientes con saldo pendiente."
              items={data.debtors.map((debtor) => ({
                label: debtor.name,
                value: debtor.balance.toNumber(),
                valueLabel: formatARS(debtor.balance),
                tone: "amber"
              }))}
            />
          </div>
        </ReportSection>

        <ReportSection
          title="Compras y proveedores"
          description="Impacto de compras recibidas dentro del periodo."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard
              label="Compras"
              value={formatARS(executive.purchasesTotal)}
              detail="Solo compras recibidas."
              compact
            />
            <MetricCard
              label="Resultado comercial"
              value={formatARS(executive.salesMinusPurchases)}
              detail="Venta neta menos compras."
              tone={executive.salesMinusPurchases.lt(0) ? "red" : "green"}
              compact
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ReportList
              dense
              emptyText="Sin compras en el periodo."
              items={data.purchases.map((purchase) => ({
                id: purchase.id,
                title: `Compra #${purchase.purchaseNumber}`,
                description: `${purchase.supplierName} - ${formatDateTimeStable(
                  purchase.createdAt
                )}`,
                value: formatARS(purchase.total),
                action: (
                  <LinkButton href={`/compras/${purchase.id}`} size="sm" variant="outline">
                    Ver
                  </LinkButton>
                )
              }))}
            />
            <BarList
              emptyText="Sin proveedores en el periodo."
              items={data.suppliers.map((supplier) => ({
                label: supplier.name,
                value: supplier.total.toNumber(),
                valueLabel: formatARS(supplier.total),
                detail: `${supplier.count} compras`,
                tone: "gray"
              }))}
            />
          </div>
        </ReportSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ReportSection title="Alertas accionables">
          <ReportList
            emptyText="No hay alertas relevantes para el periodo."
            items={data.alerts.map((alert, index) => alertListItem(alert, index))}
          />
        </ReportSection>

        <ReportSection title="Ventas anuladas recientes">
          <ReportList
            emptyText="Sin anulaciones en el periodo."
            items={data.recentCancelledSales.map((sale) => saleListItem(sale))}
          />
        </ReportSection>
      </div>
    </section>
  );
}

function saleListItem(sale: {
  id: string;
  saleNumber: number;
  total: Prisma.Decimal;
  status: SaleStatus;
  createdAt: Date;
  userName: string;
  customerName: string;
}): ReportListItem {
  const isCancelled = sale.status === SaleStatus.CANCELLED;

  return {
    id: sale.id,
    title: `Venta #${sale.saleNumber}`,
    description: `${sale.customerName} - ${sale.userName} - ${formatDateTimeStable(
      sale.createdAt
    )}`,
    value: formatARS(sale.total),
    badge: isCancelled ? "Anulada" : "Pagada",
    badgeTone: isCancelled ? "red" : "green",
    action: (
      <LinkButton href={`/ventas/${sale.id}`} size="sm" variant="outline">
        Ver
      </LinkButton>
    )
  };
}

function alertListItem(alert: ReportAlert, index: number): ReportListItem {
  return {
    id: `${alert.title}-${index}`,
    title: alert.title,
    description: alert.description,
    badge: severityLabel(alert.severity),
    badgeTone: severityTone(alert.severity),
    action:
      alert.href && alert.actionLabel ? (
        <LinkButton href={alert.href} size="sm" variant="outline">
          {alert.actionLabel}
        </LinkButton>
      ) : null
  };
}

function paymentTone(method: PaymentMethod) {
  if (method === PaymentMethod.CASH) {
    return "green";
  }

  if (method === PaymentMethod.CURRENT_ACCOUNT) {
    return "amber";
  }

  if (method === PaymentMethod.MERCADOPAGO) {
    return "blue";
  }

  return "gray";
}

function paymentAttemptStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
    EXPIRED: "Vencido",
    ERROR: "Error"
  };

  return labels[status] ?? status;
}

function paymentAttemptOriginLabel(origin: string) {
  const labels: Record<string, string> = {
    QR_ORDER: "QR API",
    AMOUNT_MATCH: "Match por monto",
    MANUAL_REFERENCE: "Referencia manual"
  };

  return labels[origin] ?? origin;
}

function paymentAttemptTone(status: string): ReportListItem["badgeTone"] {
  if (status === "APPROVED") {
    return "green";
  }
  if (status === "PENDING") {
    return "amber";
  }
  if (status === "ERROR" || status === "REJECTED") {
    return "red";
  }

  return "gray";
}

function severityLabel(severity: ReportAlert["severity"]) {
  if (severity === "error") {
    return "Critica";
  }

  if (severity === "warning") {
    return "Atencion";
  }

  return "Info";
}

function severityTone(severity: ReportAlert["severity"]) {
  if (severity === "error") {
    return "red";
  }

  if (severity === "warning") {
    return "amber";
  }

  return "info";
}

function formatInteger(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0
  }).format(toNumber(value));
}

function formatDecimal(value: Prisma.Decimal | number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(toNumber(value));
}

function formatPercentNumber(value: Prisma.Decimal | number) {
  return formatPercent(toNumber(value));
}

function formatPercent(value: number) {
  return (
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value) + "%"
  );
}

function toNumber(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber();
}
