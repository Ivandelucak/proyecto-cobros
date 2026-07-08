import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { SaleStatus, Prisma } from "@prisma/client";

import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";

export const dynamic = "force-dynamic";

export default async function MobileReportesPage() {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [todaySales, allSales, products] = await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId,
        status: SaleStatus.PAID,
        createdAt: { gte: start, lt: end }
      },
      include: {
        items: true,
        payments: true
      }
    }),
    prisma.sale.findMany({
      where: {
        businessId,
        status: SaleStatus.PAID
      },
      include: {
        items: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.product.findMany({
      where: {
        businessId,
        active: true,
        deletedAt: null
      },
      select: { stock: true, minStock: true }
    })
  ]);

  // Today's stats
  const todayTotal = todaySales.reduce((sum, s) => sum.plus(s.total), new Prisma.Decimal(0));

  // Top products from recent 100 sales
  const productSalesMap = new Map<string, { name: string; quantity: number }>();
  for (const sale of allSales) {
    for (const item of sale.items) {
      const current = productSalesMap.get(item.productNameSnapshot) ?? {
        name: item.productNameSnapshot,
        quantity: 0
      };
      current.quantity += item.quantity.toNumber();
      productSalesMap.set(item.productNameSnapshot, current);
    }
  }
  const topProducts = [...productSalesMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Payments methods today
  const paymentsMap = new Map<string, number>();
  for (const sale of todaySales) {
    for (const p of sale.payments) {
      const current = paymentsMap.get(p.method) ?? 0;
      paymentsMap.set(p.method, current + p.amount.toNumber());
    }
  }
  const paymentsList = [...paymentsMap.entries()].map(([method, amount]) => ({
    method: method === "CASH"
      ? "Efectivo"
      : method === "MERCADOPAGO"
      ? "Mercado Pago"
      : method === "DEBIT_CARD"
      ? "Tarjeta Débito"
      : method === "CREDIT_CARD"
      ? "Tarjeta Crédito"
      : method === "CURRENT_ACCOUNT"
      ? "Cuenta Corriente"
      : method,
    amount
  }));

  const lowStockCount = products.filter((p) => p.stock.lte(p.minStock)).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <MobilePageHeader
        title="Reportes Operativos"
        subtitle="Estadísticas rápidas de facturación y productos."
        fallbackUrl="/m"
      />

      {/* Today Financial Summary Card */}
      <Card className="p-4 bg-[#121922] border-[#273342] space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Facturación de Hoy</h3>
        <div className="flex justify-between items-end">
          <div>
            <span className="text-[10px] text-[#A9B6C2]">Total Recaudado</span>
            <span className="block text-2xl font-black text-[#4C7FA3] mt-0.5">{formatARS(todayTotal)}</span>
          </div>
          <Badge tone={todaySales.length > 0 ? "green" : "red"}>
            {todaySales.length} cobros
          </Badge>
        </div>
      </Card>

      {/* Top products Card */}
      <Card className="p-4 bg-[#121922] border-[#273342] space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Productos más vendidos (Histórico Reciente)</h3>
        <div className="divide-y divide-[#273342] text-xs">
          {topProducts.length === 0 ? (
            <p className="py-3 text-center text-[#7F8D9A]">Aún no hay ventas registradas.</p>
          ) : (
            topProducts.map((p, idx) => (
              <div key={idx} className="py-2 flex justify-between gap-3">
                <span className="font-semibold text-[#F3F7FA] truncate">{p.name}</span>
                <span className="font-bold text-[#A9B6C2] shrink-0">{p.quantity} uds.</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Payment methods today Card */}
      <Card className="p-4 bg-[#121922] border-[#273342] space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Medios de Pago utilizados hoy</h3>
        <div className="divide-y divide-[#273342] text-xs">
          {paymentsList.length === 0 ? (
            <p className="py-3 text-center text-[#7F8D9A]">Sin cobros hoy.</p>
          ) : (
            paymentsList.map((p, idx) => (
              <div key={idx} className="py-2 flex justify-between">
                <span className="font-semibold text-[#F3F7FA]">{p.method}</span>
                <span className="font-bold text-[#4C7FA3]">{formatARS(p.amount)}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Stock warning status Card */}
      <Card className="p-4 bg-[#121922] border-[#273342] flex justify-between items-center">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Alertas de Reposición</h4>
          <p className="text-xs text-[#A9B6C2] mt-0.5">Productos con stock crítico.</p>
        </div>
        <Badge tone={lowStockCount > 0 ? "amber" : "green"}>
          {lowStockCount} alertas
        </Badge>
      </Card>
    </div>
  );
}
