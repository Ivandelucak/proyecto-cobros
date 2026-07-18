import { PaymentMethod, Prisma } from "@prisma/client";
import { MobileReportsDashboard } from "@/components/mobile/MobileReportsDashboard";
import type { ComparisonPresentation } from "@/components/reports/comparison-badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import {
  addArgentinaCalendarDays,
  formatArgentinaDateInput,
  startOfArgentinaMonth
} from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import {
  buildReportFilters,
  getReportDashboardData,
  type Comparison,
  type ReportMetric
} from "@/lib/reports/report-service";
import { formatStock } from "@/lib/stock-format";

export const dynamic = "force-dynamic";

type MobileReportesPageProps = {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    method?: string;
  }>;
};

type MobileRange = "today" | "seven-days" | "month" | "custom";

export default async function MobileReportesPage({ searchParams }: MobileReportesPageProps) {
  const user = await requireMobileAuth();
  const params = await searchParams;
  const { filters, range, filterError } = resolveMobileFilters(params);
  const data = await getReportDashboardData(filters, user.businessId!);
  const executive = data.executive;
  const paymentMethodLabel = filters.method ? data.paymentLabels[filters.method] : "Todos los pagos";
  const trendItems = range === "today" ? data.hourlySales : data.dailySales;

  return (
    <MobileReportsDashboard
      key={`${filters.from}-${filters.to}-${filters.method ?? "all"}`}
      filters={{ ...filters, range }}
      periodLabel={formatMobilePeriod(filters.from, filters.to)}
      paymentMethodLabel={paymentMethodLabel}
      paymentOptions={Object.values(PaymentMethod).map((method) => ({
        value: method,
        label: data.paymentLabels[method]
      }))}
      filterError={filterError}
      metrics={[
        metricView("Venta neta", executive.netSold, formatARS, "Ventas pagadas.", "blue"),
        metricView(
          "Ganancia estimada",
          executive.estimatedProfit,
          formatARS,
          executive.hasIncompleteCosts ? "Estimacion parcial por costos incompletos." : "Con costos cargados.",
          "green"
        ),
        metricView("Ticket promedio", executive.averageTicket, formatARS, "Por venta pagada."),
        metricView(
          "Ventas pagadas",
          executive.paidSalesCount,
          formatInteger,
          `${executive.cancelledSalesCount} anuladas`
        ),
        metricView("Margen estimado", executive.marginPercent, formatPercent, "Sobre venta neta."),
        metricView(
          "Unidades vendidas",
          executive.unitsSold,
          (value) => formatDecimal(value, 3),
          `${formatInteger(executive.itemsSold)} lineas`
        ),
        metricView(
          "Total anulado",
          executive.cancelledTotal,
          formatARS,
          `${formatPercent(executive.cancellationRate)} de operaciones`
        ),
        metricView("Ventas a cuenta", executive.currentAccountSales, formatARS, "Operaciones financiadas.", "amber")
      ]}
      trend={{
        title: range === "today" ? "Tendencia por hora" : "Tendencia de ventas",
        description:
          range === "today"
            ? "Facturacion por franja horaria de Argentina. Toca una barra para ver el detalle."
            : "Facturacion diaria dentro del rango seleccionado. Toca una barra para ver el detalle.",
        points: trendItems.map((item) => ({
          id: "hour" in item ? `hour-${item.hour}` : item.date,
          label: item.label,
          value: item.total.toNumber(),
          valueLabel: formatARS(item.total),
          count: item.count
        }))
      }}
      payments={data.paymentBreakdown.map((payment) => ({
        label: payment.label,
        total: payment.total.toNumber(),
        totalLabel: formatARS(payment.total),
        percentLabel: formatPercent(payment.percent),
        count: payment.count
      }))}
      products={data.topProductsByQuantityExtended.map((product) => ({
        id: product.productId,
        name: product.name,
        categoryName: product.categoryName,
        quantityLabel: `${formatDecimal(product.quantity, 3)} unidades`,
        revenueLabel: formatARS(product.revenue),
        href: product.productId.startsWith("manual_") ? null : `/m/productos/${product.productId}`
      }))}
      categories={data.categories.map((category) => ({
        name: category.categoryName,
        revenue: category.revenue.toNumber(),
        revenueLabel: formatARS(category.revenue),
        percentLabel: formatPercent(category.percent),
        quantityLabel: `${formatDecimal(category.quantity, 3)} unidades`
      }))}
      profitability={{
        netSold: formatARS(executive.netSold.value),
        estimatedCost: executive.hasIncompleteCosts
          ? "Costos incompletos"
          : formatARS(decimal(executive.netSold.value).minus(decimal(executive.estimatedProfit.value))),
        estimatedProfit: formatARS(executive.estimatedProfit.value),
        margin: formatPercent(executive.marginPercent.value),
        hasIncompleteCosts: executive.hasIncompleteCosts,
        missingCostProductCount: executive.missingCostProductCount
      }}
      purchases={{
        total: formatARS(executive.purchasesTotal),
        count: executive.purchasesCount,
        difference: formatARS(executive.salesMinusPurchases),
        differenceTone: executive.salesMinusPurchases.lt(0) ? "red" : executive.salesMinusPurchases.gt(0) ? "green" : "default"
      }}
      stock={{
        lowCount: executive.lowStockCount,
        outCount: executive.outOfStockCount,
        products: data.lowStockProducts.map((product) => ({
          id: product.id,
          name: product.name,
          categoryName: product.categoryName,
          stockLabel: formatStock(product.stock, product.unitType),
          minStockLabel: formatStock(product.minStock, product.unitType)
        }))
      }}
    />
  );
}

function resolveMobileFilters(params: Awaited<MobileReportesPageProps["searchParams"]>) {
  const today = formatArgentinaDateInput();
  const requestedRange = params.range;
  const range: MobileRange =
    requestedRange === "seven-days" || requestedRange === "month" || requestedRange === "custom"
      ? requestedRange
      : "today";
  const preset = mobileRangeDates(range, today, params);

  try {
    return {
      range,
      filters: buildReportFilters({ ...preset, method: params.method }),
      filterError: null
    };
  } catch (error) {
    return {
      range: "today" as const,
      filters: buildReportFilters({ from: today, to: today }),
      filterError: error instanceof Error ? error.message : "No se pudo aplicar el filtro solicitado."
    };
  }
}

function mobileRangeDates(
  range: MobileRange,
  today: string,
  params: Awaited<MobileReportesPageProps["searchParams"]>
) {
  if (range === "seven-days") {
    return { from: addArgentinaCalendarDays(today, -6), to: today };
  }

  if (range === "month") {
    return { from: startOfArgentinaMonth(today), to: today };
  }

  if (range === "custom") {
    return { from: params.from ?? today, to: params.to ?? today };
  }

  return { from: today, to: today };
}

function metricView(
  label: string,
  metric: ReportMetric,
  formatter: (value: Prisma.Decimal | number) => string,
  detail: string,
  tone?: "default" | "blue" | "green" | "amber" | "red"
) {
  return {
    label,
    value: formatter(metric.value),
    detail,
    comparison: comparisonView(metric.comparison),
    previousLabel:
      metric.comparison.state === "no-activity" && metric.comparison.previousValue !== null
        ? formatter(metric.comparison.previousValue)
        : undefined,
    tone
  };
}

function comparisonView(comparison: Comparison): ComparisonPresentation {
  return {
    direction: comparison.direction,
    percent: comparison.percent,
    state: comparison.state,
    tone: comparison.tone
  };
}

function formatMobilePeriod(from: string, to: string) {
  const start = mobileDateParts(from);
  const end = mobileDateParts(to);
  if (from === to) {
    return `${start.day} ${start.month} ${start.year}`;
  }

  if (start.year === end.year) {
    return `${start.day} ${start.month} - ${end.day} ${end.month} ${end.year}`;
  }

  return `${start.day} ${start.month} ${start.year} - ${end.day} ${end.month} ${end.year}`;
}

function mobileDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return { year, month: months[month - 1] ?? "", day };
}

function formatInteger(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(decimal(value).toNumber());
}

function formatDecimal(value: Prisma.Decimal | number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(decimal(value).toNumber());
}

function formatPercent(value: Prisma.Decimal | number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(decimal(value).toNumber())}%`;
}

function decimal(value: Prisma.Decimal | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}
