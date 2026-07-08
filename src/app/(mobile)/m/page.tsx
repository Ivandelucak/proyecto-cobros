import { SaleStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";
import { formatARS } from "@/lib/money";
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
      where: {
        businessId,
        status: SaleStatus.PAID,
        createdAt: { gte: start, lt: end }
      },
      select: { total: true }
    }),
    prisma.product.findMany({
      where: {
        businessId,
        active: true,
        deletedAt: null
      },
      select: { stock: true, minStock: true }
    }),
    prisma.sale.findMany({
      where: { businessId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 4
    })
  ]);

  const lowCount = stockLowProducts.filter((p) => p.stock.lte(p.minStock)).length;
  const todayTotal = todaySales.reduce((sum, s) => sum.plus(s.total), new Prisma.Decimal(0));

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-[#F3F7FA]">Resumen de Hoy</h2>
        <p className="text-xs text-[#A9B6C2]">Información clave de tu comercio en tiempo real.</p>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-[#121922] border-[#273342] flex flex-col justify-between min-h-[90px]">
          <span className="text-xs font-semibold text-[#A9B6C2]">Vendido Hoy</span>
          <span className="text-lg font-bold text-[#F3F7FA] mt-1">{formatARS(todayTotal)}</span>
          <span className="text-[10px] text-[#7F8D9A] mt-1">{todaySales.length} ventas</span>
        </Card>

        <Card className="p-4 bg-[#121922] border-[#273342] flex flex-col justify-between min-h-[90px]">
          <span className="text-xs font-semibold text-[#A9B6C2]">Caja Diaria</span>
          <span className={`text-sm font-bold mt-1 ${cashSession ? "text-[#28A36A]" : "text-[#E16060]"}`}>
            {cashSession ? "Abierta" : "Cerrada"}
          </span>
          <span className="text-[10px] text-[#7F8D9A] mt-1">
            {cashSession ? `Caja: ${formatARS(cashSession.summary.expectedCash)}` : "Sin iniciar"}
          </span>
        </Card>

        <Card className="p-4 bg-[#121922] border-[#273342] flex flex-col justify-between min-h-[90px]">
          <span className="text-xs font-semibold text-[#A9B6C2]">Alertas de Stock</span>
          <span className={`text-lg font-bold mt-1 ${lowCount > 0 ? "text-[#D49A2F]" : "text-[#28A36A]"}`}>
            {lowCount}
          </span>
          <span className="text-[10px] text-[#7F8D9A] mt-1">Bajo stock</span>
        </Card>

        <Card className="p-4 bg-[#121922] border-[#273342] flex flex-col justify-between min-h-[90px] justify-center items-center">
          <Link
            href="/m/presupuestos/nuevo"
            className="w-full h-full flex flex-col items-center justify-center text-center text-[#4C7FA3] hover:text-[#F3F7FA]"
          >
            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-bold">Nuevo Presupuesto</span>
          </Link>
        </Card>
      </div>

      {/* Access Grid */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A] mb-3">Accesos Rápidos</h3>
        <div className="grid grid-cols-3 gap-2.5">
          <AccessButton href="/m/ventas" label="Ventas" icon="sales" />
          <AccessButton href="/m/presupuestos" label="Presupuestos" icon="quote" />
          <AccessButton href="/m/productos" label="Productos" icon="box" />
          <AccessButton href="/m/stock" label="Stock" icon="stock" />
          <AccessButton href="/m/categorias" label="Categorías" icon="tag" />
          <AccessButton href="/m/compras" label="Compras" icon="cart" />
          <AccessButton href="/m/reportes" label="Reportes" icon="chart" className="col-span-3 py-3" />
        </div>
      </div>

      {/* Recent Sales */}
      <Card className="p-4 bg-[#121922] border-[#273342]">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-sm font-bold text-[#F3F7FA]">Últimas Ventas</h3>
          <Link href="/m/ventas" className="text-xs font-bold text-[#4C7FA3]">
            Ver todas
          </Link>
        </div>

        <div className="divide-y divide-[#273342]">
          {latestSales.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#7F8D9A]">Aún no hay ventas registradas.</p>
          ) : (
            latestSales.map((sale) => (
              <Link
                key={sale.id}
                href={`/m/ventas/${sale.id}`}
                className="flex items-center justify-between py-2.5 hover:bg-[#1D3140]/10 transition-colors"
              >
                <div>
                  <p className="font-semibold text-sm text-[#F3F7FA]">Venta #{sale.saleNumber}</p>
                  <p className="text-[11px] text-[#A9B6C2]">{sale.user.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-[#F3F7FA]">{formatARS(sale.total)}</p>
                  <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                    {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                  </Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function AccessButton({
  href,
  label,
  icon,
  className = ""
}: {
  href: string;
  label: string;
  icon: string;
  className?: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    sales: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z" />
      </svg>
    ),
    quote: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    box: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    stock: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
    tag: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    cart: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5 text-[#4C7FA3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    )
  };

  return (
    <Link
      href={href}
      className={`bg-[#121922] border border-[#273342] rounded-lg p-2.5 flex flex-col items-center justify-center text-center hover:bg-[#1D3140]/25 hover:border-[#4C7FA3]/40 transition-all ${className}`}
    >
      <div className="mb-1.5">{icons[icon]}</div>
      <span className="text-[11px] font-bold text-[#F3F7FA]">{label}</span>
    </Link>
  );
}
