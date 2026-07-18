import { SaleStatus } from "@prisma/client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { formatARS } from "@/lib/money";
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
import { prisma } from "@/lib/prisma";
import {
  getArgentinaLastCalendarDaysRange,
  getArgentinaTodayRange,
  getArgentinaYesterdayRange,
  formatDateTimeStable
} from "@/lib/date-format";
import { buildOperationalSaleDateWhere } from "@/lib/sale-date-range";

import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";

export const dynamic = "force-dynamic";

type VentasMobilePageProps = {
  searchParams: Promise<{
    period?: string;
  }>;
};

export default async function MobileVentasPage({ searchParams }: VentasMobilePageProps) {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const params = await searchParams;
  const period = parseMobileSalesPeriod(params.period);

  const dateRange = getSalesPeriodRange(period);

  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      ...(dateRange ? buildOperationalSaleDateWhere(dateRange) : {})
    },
    include: {
      payments: { select: { id: true, amount: true, method: true } },
      user: { select: { name: true } }
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <MobilePageHeader
        title="Listado de Ventas"
        subtitle="Consulta histórica y estado de cobros."
        fallbackUrl="/m"
      />

      {/* Date Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 bg-[#121922] p-1 rounded-lg border border-[#273342]">
        <FilterLink active={period === "today"} href="/m/ventas?period=today" label="Hoy" />
        <FilterLink active={period === "yesterday"} href="/m/ventas?period=yesterday" label="Ayer" />
        <FilterLink active={period === "week"} href="/m/ventas?period=week" label="7 días" />
        <FilterLink active={period === "all"} href="/m/ventas?period=all" label="Todos" />
      </div>

      {/* Sales List */}
      <div className="space-y-3">
        {sales.length === 0 ? (
          <Card className="p-8 text-center bg-[#121922] border-[#273342]">
            <p className="text-sm text-[#A9B6C2]">No hay ventas para este período.</p>
          </Card>
        ) : (
          sales.map((sale) => (
            <Link key={sale.id} href={`/m/ventas/${sale.id}`} className="block">
              <Card className="p-4 bg-[#121922] border-[#273342] hover:border-[#4C7FA3]/50 active:bg-[#1D3140]/10 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                  <h4 className="font-bold text-sm text-[#F3F7FA]">Venta #{formatInternalSaleNumber(sale)}</h4>
                    <p className="text-[11px] text-[#A9B6C2] mt-0.5">
                      {formatDateTimeStable(sale.occurredAt ?? sale.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-sm text-[#F3F7FA]">{formatARS(sale.total)}</span>
                    <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                      {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#273342] flex justify-between items-center text-[10px] text-[#7F8D9A]">
                  <span>Vendedor: {sale.user.name}</span>
                  <span className="text-[#4C7FA3] font-bold">Ver detalle &rarr;</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

type MobileSalesPeriod = "today" | "yesterday" | "week" | "all";

function parseMobileSalesPeriod(value: string | undefined): MobileSalesPeriod {
  if (value === "yesterday" || value === "week" || value === "all") {
    return value;
  }

  return "today";
}

function getSalesPeriodRange(period: MobileSalesPeriod) {
  if (period === "today") {
    return getArgentinaTodayRange();
  }

  if (period === "yesterday") {
    return getArgentinaYesterdayRange();
  }

  if (period === "week") {
    return getArgentinaLastCalendarDaysRange(7);
  }

  return null;
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all text-center flex-1 whitespace-nowrap ${
        active
          ? "bg-[#4C7FA3] text-[#0B1015] shadow"
          : "text-[#A9B6C2] hover:text-[#F3F7FA] hover:bg-[#1D3140]/20"
      }`}
    >
      {label}
    </Link>
  );
}
