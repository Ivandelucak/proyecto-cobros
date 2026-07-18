"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComparisonBadge, type ComparisonPresentation } from "@/components/reports/comparison-badge";
import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { AppModal } from "@/components/ui/overlay";
import { cn } from "@/lib/ui";

type MobileMetric = {
  label: string;
  value: string;
  detail: string;
  comparison: ComparisonPresentation;
  previousLabel?: string;
  tone?: "default" | "blue" | "green" | "amber" | "red";
};

type TrendPoint = {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  count: number;
};

type MobileReportsDashboardProps = {
  filters: {
    from: string;
    to: string;
    method: string | null;
    range: "today" | "seven-days" | "month" | "custom";
  };
  periodLabel: string;
  paymentMethodLabel: string;
  paymentOptions: Array<{ value: string; label: string }>;
  filterError: string | null;
  metrics: MobileMetric[];
  trend: {
    title: string;
    description: string;
    points: TrendPoint[];
  };
  payments: Array<{
    label: string;
    total: number;
    totalLabel: string;
    percentLabel: string;
    count: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    categoryName: string;
    quantityLabel: string;
    revenueLabel: string;
    href: string | null;
  }>;
  categories: Array<{
    name: string;
    revenue: number;
    revenueLabel: string;
    percentLabel: string;
    quantityLabel: string;
  }>;
  profitability: {
    netSold: string;
    estimatedCost: string;
    estimatedProfit: string;
    margin: string;
    hasIncompleteCosts: boolean;
    missingCostProductCount: number;
  };
  purchases: {
    total: string;
    count: number;
    difference: string;
    differenceTone: "green" | "red" | "default";
  };
  stock: {
    lowCount: number;
    outCount: number;
    products: Array<{
      id: string;
      name: string;
      categoryName: string;
      stockLabel: string;
      minStockLabel: string;
    }>;
  };
};

const rangeOptions: Array<{ value: MobileReportsDashboardProps["filters"]["range"]; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "seven-days", label: "7 dias" },
  { value: "month", label: "Este mes" }
];

export function MobileReportsDashboard({
  filters,
  periodLabel,
  paymentMethodLabel,
  paymentOptions,
  filterError,
  metrics,
  trend,
  payments,
  products,
  categories,
  profitability,
  purchases,
  stock
}: MobileReportsDashboardProps) {
  const router = useRouter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [method, setMethod] = useState(filters.method ?? "");
  const [filterMessage, setFilterMessage] = useState<string | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [sections, setSections] = useState({
    payments: false,
    products: false,
    categories: false,
    profitability: false,
    stock: false
  });

  const filteredProducts = showAllProducts ? products : products.slice(0, 5);
  const hasSales = metrics.some((metric) => metric.label === "Ventas pagadas" && metric.value !== "0");

  function buildHref(range: MobileReportsDashboardProps["filters"]["range"]) {
    const params = new URLSearchParams({ range });
    if (filters.method) {
      params.set("method", filters.method);
    }
    return `/m/reportes?${params.toString()}`;
  }

  function applyCustomFilter() {
    if (!from || !to) {
      setFilterMessage("Indicá una fecha desde y una fecha hasta.");
      return;
    }

    if (from > to) {
      setFilterMessage("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }

    const params = new URLSearchParams({ range: "custom", from, to });
    if (method) {
      params.set("method", method);
    }
    setFilterOpen(false);
    setFilterMessage(null);
    router.push(`/m/reportes?${params.toString()}`);
  }

  function resetFilters() {
    setFilterOpen(false);
    setFilterMessage(null);
    router.push("/m/reportes?range=today");
  }

  function toggleSection(section: keyof typeof sections) {
    setSections((current) => ({ ...current, [section]: !current[section] }));
  }

  return (
    <div className="space-y-4 pb-2">
      <MobilePageHeader
        title="Reportes"
        subtitle={`${periodLabel} - ${paymentMethodLabel}`}
        subtitleClassName="whitespace-normal leading-5"
        fallbackUrl="/m"
      />

      <div className="rounded-xl border border-[#273342] bg-[#121922] p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.18)]">
        <div className="grid grid-cols-4 gap-1.5">
          {rangeOptions.map((option) => (
            <Link
              key={option.value}
              href={buildHref(option.value)}
              className={rangeButtonClass(filters.range === option.value)}
            >
              {option.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={rangeButtonClass(filters.range === "custom")}
          >
            Personalizado
          </button>
        </div>
      </div>

      {filterError ? (
        <p role="alert" className="rounded-lg border border-[#C98A26]/45 bg-[#C98A26]/10 px-3 py-2 text-sm text-[#FFE4A6]">
          {filterError}
        </p>
      ) : null}

      {!hasSales ? (
        <p role="status" className="rounded-lg border border-[#344657] bg-[#1A2430] px-3 py-2.5 text-sm leading-5 text-[#C6D1DB]">
          No se registraron ventas pagadas en el periodo seleccionado.
        </p>
      ) : null}

      <section aria-labelledby="mobile-report-summary">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="mobile-report-summary" className="text-base font-extrabold text-[#F3F7FA]">Resumen</h2>
          <span className="text-xs font-medium text-[#7F8D9A]">Vs. periodo anterior</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((metric) => (
            <MobileMetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <MobilePanel title={trend.title} description={trend.description}>
        <MobileSalesTrend points={trend.points} />
      </MobilePanel>

      <MobileCollapsiblePanel
        title="Medios de pago"
        description="Importe, participacion y operaciones del periodo."
        open={sections.payments}
        onToggle={() => toggleSection("payments")}
      >
        {payments.length === 0 ? (
          <EmptyText>Sin pagos en el periodo.</EmptyText>
        ) : (
          <MobileBars
            items={payments.map((payment) => ({
              id: payment.label,
              label: payment.label,
              value: payment.total,
              valueLabel: payment.totalLabel,
              detail: `${payment.count} operaciones - ${payment.percentLabel}`
            }))}
          />
        )}
      </MobileCollapsiblePanel>

      <MobileCollapsiblePanel
        title="Productos mas vendidos"
        description="Unidades y facturacion dentro del rango activo."
        open={sections.products}
        onToggle={() => toggleSection("products")}
      >
        {filteredProducts.length === 0 ? (
          <EmptyText>Sin productos vendidos en el periodo.</EmptyText>
        ) : (
          <ol className="divide-y divide-[#273342]">
            {filteredProducts.map((product, index) => {
              const content = (
                <>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#1D3140] text-xs font-black text-[#8CA3B7]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#F3F7FA]">{product.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#7F8D9A]">{product.categoryName}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-[#D6E4EE]">{product.revenueLabel}</span>
                    <span className="mt-0.5 block text-xs text-[#8CA3B7]">{product.quantityLabel}</span>
                  </span>
                </>
              );

              return (
                <li key={product.id}>
                  {product.href ? (
                    <Link href={product.href} className="flex min-h-14 items-center gap-2 py-2.5 active:opacity-75">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 items-center gap-2 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {products.length > 5 ? (
          <button
            type="button"
            onClick={() => setShowAllProducts((current) => !current)}
            className="mt-3 min-h-10 w-full rounded-lg border border-[#344657] bg-[#1A2430] px-3 text-sm font-bold text-[#D6E4EE] transition-colors active:bg-[#263C4F]"
          >
            {showAllProducts ? "Ver menos" : `Ver todos (${products.length})`}
          </button>
        ) : null}
      </MobileCollapsiblePanel>

      <MobileCollapsiblePanel
        title="Categorias lideres"
        description="Facturacion y unidades vendidas por categoria."
        open={sections.categories}
        onToggle={() => toggleSection("categories")}
      >
        {categories.length === 0 ? (
          <EmptyText>Sin ventas por categoria en el periodo.</EmptyText>
        ) : (
          <MobileBars
            items={categories.map((category) => ({
              id: category.name,
              label: category.name,
              value: category.revenue,
              valueLabel: category.revenueLabel,
              detail: `${category.percentLabel} - ${category.quantityLabel}`
            }))}
          />
        )}
      </MobileCollapsiblePanel>

      <MobileCollapsiblePanel
        title="Rentabilidad"
        description="Estimacion basada en los costos cargados."
        open={sections.profitability}
        onToggle={() => toggleSection("profitability")}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <ValueLine label="Venta neta" value={profitability.netSold} />
          <ValueLine label="Costo estimado" value={profitability.estimatedCost} />
          <ValueLine label="Ganancia estimada" value={profitability.estimatedProfit} tone="green" />
          <ValueLine label="Margen estimado" value={profitability.margin} tone="blue" />
        </div>
        {profitability.hasIncompleteCosts ? (
          <p className="mt-3 rounded-lg border border-[#C98A26]/45 bg-[#C98A26]/10 px-3 py-2 text-xs leading-5 text-[#FFE4A6]">
            Estimacion parcial: {profitability.missingCostProductCount} productos vendidos sin costo cargado.
          </p>
        ) : null}
      </MobileCollapsiblePanel>

      <MobilePanel title="Ventas y compras" description="Diferencia entre ventas y compras recibidas en el periodo.">
        <div className="grid grid-cols-2 gap-2.5">
          <ValueLine label="Vendido" value={profitability.netSold} />
          <ValueLine label={`Compras (${purchases.count})`} value={purchases.total} />
          <ValueLine label="Diferencia" value={purchases.difference} tone={purchases.differenceTone} />
        </div>
      </MobilePanel>

      <MobileCollapsiblePanel
        title="Alertas de reposicion"
        description={`${stock.lowCount} productos en minimo o por debajo. ${stock.outCount} sin stock.`}
        open={sections.stock}
        onToggle={() => toggleSection("stock")}
        action={<Link href="/m/stock" className="text-xs font-bold text-[#8CA3B7]">Ver stock</Link>}
      >
        {stock.products.length === 0 ? (
          <EmptyText>Stock sin alertas de reposicion.</EmptyText>
        ) : (
          <div className="divide-y divide-[#273342]">
            {stock.products.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#F3F7FA]">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#7F8D9A]">{product.categoryName}</p>
                </div>
                <p className="shrink-0 text-right text-xs leading-5 text-[#D6E4EE]">
                  <span className="block font-bold">Stock: {product.stockLabel}</span>
                  <span className="text-[#7F8D9A]">Minimo: {product.minStockLabel}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </MobileCollapsiblePanel>

      <AppModal
        open={filterOpen}
        onClose={() => {
          setFilterOpen(false);
          setFilterMessage(null);
        }}
        title="Filtrar reportes"
        description="Elegí un rango de fechas y, si hace falta, un medio de pago."
        panelClassName="max-w-[min(100vw-1rem,440px)]"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={resetFilters}>Restablecer</Button>
            <Button type="button" variant="primary" onClick={applyCustomFilter}>Aplicar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            Desde
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1.5" />
          </label>
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            Hasta
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1.5" />
          </label>
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            Medio de pago
            <Select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1.5">
              <option value="">Todos los pagos</option>
              {paymentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          {filterMessage ? <p role="alert" className="text-sm text-[var(--danger)]">{filterMessage}</p> : null}
        </div>
      </AppModal>
    </div>
  );
}

function MobileMetricCard({ metric }: { metric: MobileMetric }) {
  return (
    <Card className="min-w-0 border-[#273342] bg-[#121922] p-3 shadow-none ring-0">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#7F8D9A]">{metric.label}</p>
      <p className={cn("mt-1.5 break-words text-xl font-black leading-tight", metricValueTones[metric.tone ?? "default"])}>
        {metric.value}
      </p>
      <div className="mt-2 min-h-5 space-y-1">
        <ComparisonBadge comparison={metric.comparison} compact />
        {metric.previousLabel ? <p className="text-[11px] leading-4 text-[#7F8D9A]">Anterior: {metric.previousLabel}</p> : null}
        <p className="text-[11px] leading-4 text-[#A9B6C2]">{metric.detail}</p>
      </div>
    </Card>
  );
}

function MobilePanel({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#273342] bg-[#121922] p-3.5 shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
      <h2 className="text-base font-extrabold text-[#F3F7FA]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[#A9B6C2]">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MobileCollapsiblePanel({
  title,
  description,
  open,
  onToggle,
  action,
  children
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useMemo(() => `mobile-report-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, [title]);

  return (
    <section className="rounded-xl border border-[#273342] bg-[#121922] shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
      <div className="flex items-center gap-2 p-3.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]"
        >
          <span className="flex items-center gap-2">
            <span className="text-base font-extrabold text-[#F3F7FA]">{title}</span>
            <span className="text-sm text-[#8CA3B7]" aria-hidden="true">{open ? "−" : "+"}</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#A9B6C2]">{description}</span>
        </button>
        {action ? <span className="shrink-0">{action}</span> : null}
      </div>
      {open ? <div id={id} className="border-t border-[#273342] px-3.5 pb-3.5 pt-3">{children}</div> : null}
    </section>
  );
}

function MobileSalesTrend({ points }: { points: TrendPoint[] }) {
  const [selectedId, setSelectedId] = useState(points.find((point) => point.value > 0)?.id ?? points[0]?.id ?? "");
  const max = Math.max(...points.map((point) => point.value), 0);
  const selected = points.find((point) => point.id === selectedId) ?? points[0];

  if (!points.some((point) => point.value > 0)) {
    return <EmptyText>Sin ventas para mostrar tendencia.</EmptyText>;
  }

  return (
    <div>
      <div
        className="grid h-36 items-end gap-px"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        role="list"
        aria-label="Tendencia de ventas"
      >
        {points.map((point) => {
          const height = max > 0 ? Math.max(5, (point.value / max) * 100) : 0;
          const selectedPoint = point.id === selectedId;
          return (
            <button
              key={point.id}
              type="button"
              role="listitem"
              onClick={() => setSelectedId(point.id)}
              className={cn(
                "group flex h-full min-w-0 items-end rounded-sm px-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CA3B7]",
                selectedPoint && "bg-[#1D3140]"
              )}
              aria-label={`${point.label}: ${point.valueLabel}, ${point.count} operaciones`}
              title={`${point.label}: ${point.valueLabel}, ${point.count} operaciones`}
            >
              <span
                className={cn("w-full rounded-sm bg-[#4C7FA3] transition-colors", selectedPoint && "bg-[#8CA3B7]")}
                style={{ height: `${height}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#7F8D9A]">
        <span>{points[0]?.label}</span>
        <span className="truncate text-center font-semibold text-[#D6E4EE]">{selected ? `${selected.label}: ${selected.valueLabel}` : ""}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      {selected ? <p className="mt-1 text-center text-xs text-[#A9B6C2]">{selected.count} operaciones</p> : null}
    </div>
  );
}

function MobileBars({
  items
}: {
  items: Array<{ id: string; label: string; value: number; valueLabel: string; detail: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = max > 0 ? Math.max(5, (item.value / max) * 100) : 0;
        return (
          <div key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#F3F7FA]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[#A9B6C2]">{item.detail}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-[#D6E4EE]">{item.valueLabel}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#273342]">
              <div className="h-full rounded-full bg-[#4C7FA3]" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ValueLine({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-[#273342] bg-[#0F151D] px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7F8D9A]">{label}</p>
      <p className={cn("mt-1 text-sm font-black", metricValueTones[tone])}>{value}</p>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-[#344657] px-3 py-5 text-center text-sm leading-5 text-[#A9B6C2]">{children}</p>;
}

function rangeButtonClass(active: boolean) {
  return cn(
    "flex min-h-10 min-w-0 items-center justify-center rounded-lg px-1 text-center text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CA3B7]",
    active ? "bg-[#4C7FA3] text-[#0B1015]" : "text-[#A9B6C2] hover:bg-[#1D3140] hover:text-[#F3F7FA]"
  );
}

const metricValueTones = {
  default: "text-[#F3F7FA]",
  blue: "text-[#8CA3B7]",
  green: "text-[#6ED4A4]",
  amber: "text-[#FFD18A]",
  red: "text-[#FFAAA8]"
};
