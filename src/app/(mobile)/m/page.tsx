import { SaleStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileIcon } from "@/components/mobile/MobileIcon";
import { MobileQuickAccessCard } from "@/components/mobile/MobileQuickAccessCard";
import { requireMobileAuth } from "@/lib/admin-auth";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";
import { formatARS } from "@/lib/money";
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MobileDashboardPage() {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [cashSession, todaySales, stockLowProducts, latestSales] = await Promise.all([
    getOpenCashSessionSnapshot(businessId),
    prisma.sale.findMany({
      where: { businessId, status: SaleStatus.PAID, createdAt: { gte: start, lt: end } },
      select: { total: true }
    }),
    prisma.product.findMany({
      where: { businessId, active: true, deletedAt: null },
      select: { stock: true, minStock: true }
    }),
    prisma.sale.findMany({
      where: { businessId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 4
    })
  ]);

  const lowCount = stockLowProducts.filter((product) => product.stock.lte(product.minStock)).length;
  const todayTotal = todaySales.reduce((sum, sale) => sum.plus(sale.total), new Prisma.Decimal(0));

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-bold text-[#8CA3B7]">Operación diaria</p>
        <h1 className="mt-1 text-[24px] font-extrabold leading-[1.15] text-[#F3F7FA]">Resumen de hoy</h1>
        <p className="mt-1.5 text-sm leading-5 text-[#A9B6C2]">Información clave de tu comercio en tiempo real.</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Vendido hoy" value={formatARS(todayTotal)} hint={`${todaySales.length} ventas`} />
        <MetricCard label="Caja diaria" value={cashSession ? "Abierta" : "Cerrada"} hint={cashSession ? `Caja: ${formatARS(cashSession.summary.expectedCash)}` : "Sin iniciar"} tone={cashSession ? "success" : "danger"} />
        <MetricCard label="Alertas de stock" value={String(lowCount)} hint="Bajo stock" tone={lowCount > 0 ? "warning" : "success"} />
        <Link href="/m/presupuestos/nuevo" className="flex min-h-[118px] flex-col justify-between rounded-xl border border-[#5D88A8] bg-[#1D3140] p-4 text-[#F3F7FA] shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#263C4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#4C7FA3] text-[#0B1015]"><MobileIcon name="plus" className="h-6 w-6" /></span>
          <span className="text-sm font-extrabold leading-5">Nuevo presupuesto</span>
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.1em] text-[#A9B6C2]">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-3">
          <MobileQuickAccessCard href="/m/ventas" label="Ventas" icon="sales" />
          <MobileQuickAccessCard href="/m/presupuestos" label="Presupuestos" icon="quote" />
          <MobileQuickAccessCard href="/m/productos" label="Productos" icon="box" />
          <MobileQuickAccessCard href="/m/stock" label="Stock" icon="stock" />
          <MobileQuickAccessCard href="/m/categorias" label="Categorías" icon="tag" />
          <MobileQuickAccessCard href="/m/compras" label="Compras" icon="cart" />
          <MobileQuickAccessCard href="/m/reportes" label="Reportes" icon="chart" className="col-span-2" />
        </div>
      </section>

      <section className="rounded-xl border border-[#273342] bg-[#121922] p-4 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#F3F7FA]">Últimas ventas</h2>
          <Link href="/m/ventas" className="inline-flex min-h-10 items-center text-sm font-bold text-[#8CA3B7] hover:text-[#D6E4EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">Ver todas</Link>
        </div>
        <div className="divide-y divide-[#273342]">
          {latestSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#A9B6C2]">Aún no hay ventas registradas.</p>
          ) : (
            latestSales.map((sale) => (
              <Link key={sale.id} href={`/m/ventas/${sale.id}`} className="flex min-h-[64px] items-center justify-between gap-3 py-3 transition-colors hover:bg-[#1D3140]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">
                <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-[#F3F7FA]">Venta #{formatInternalSaleNumber(sale)}</p>
                  <p className="mt-0.5 truncate text-xs text-[#A9B6C2]">{sale.user.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-extrabold text-[#F3F7FA]">{formatARS(sale.total)}</p>
                  <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>{sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}</Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-[#6ED4A4]" : tone === "warning" ? "text-[#E4B65B]" : tone === "danger" ? "text-[#F08A8A]" : "text-[#F3F7FA]";
  return (
    <Card className="flex min-h-[118px] flex-col justify-between rounded-xl border-[#273342] bg-[#121922] p-4 shadow-sm">
      <span className="text-sm font-semibold text-[#A9B6C2]">{label}</span>
      <span className={`mt-2 text-[22px] font-extrabold leading-tight ${color}`}>{value}</span>
      <span className="mt-1 text-xs text-[#7F8D9A]">{hint}</span>
    </Card>
  );
}
