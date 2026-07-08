import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";
import { MobileStockFilters } from "@/components/mobile/MobileStockFilters";

export const dynamic = "force-dynamic";

type StockMobilePageProps = {
  searchParams: Promise<{
    filter?: string;
    q?: string;
  }>;
};

export default async function MobileStockPage({ searchParams }: StockMobilePageProps) {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const params = await searchParams;
  const filter = params.filter ?? "all";
  const q = params.q?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: {
      businessId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { barcode: { contains: q } },
              { sku: { contains: q } }
            ]
          }
        : {})
    },
    include: {
      category: { select: { name: true } }
    },
    orderBy: { name: "asc" }
  });

  // Filter in memory according to the selected view
  const visibleProducts = products.filter((product) => {
    const isLow = product.stock.lt(product.minStock);
    const out = product.stock.lte(0);

    if (filter === "low") {
      return isLow && !out;
    }
    if (filter === "out") {
      return out;
    }
    if (filter === "ok") {
      return !isLow && !out;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <MobilePageHeader
        title="Control de Stock"
        subtitle="Nivel de existencias y alertas de reposición."
        fallbackUrl="/m"
      />

      {/* Filter and Search Form */}
      <MobileStockFilters
        initialQ={q}
        initialFilter={filter}
      />

      {/* List */}
      <div className="space-y-2.5">
        {visibleProducts.length === 0 ? (
          <Card className="p-8 text-center bg-[#121922] border-[#273342]">
            <p className="text-xs text-[#A9B6C2]">No hay productos para el filtro seleccionado.</p>
          </Card>
        ) : (
          visibleProducts.map((p) => {
            const isLow = p.stock.lt(p.minStock);
            const out = p.stock.lte(0);

            return (
              <Card key={p.id} className="p-3.5 bg-[#121922] border-[#273342] flex justify-between items-center">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-[#F3F7FA] truncate">{p.name}</h4>
                  <p className="text-[10px] text-[#7F8D9A] mt-0.5">
                    Mínimo: {p.minStock.toString()} · Cat: {p.category?.name || "Sin cat"}
                  </p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <Badge tone={out ? "red" : isLow ? "amber" : "green"}>
                    {out ? "Sin Stock" : isLow ? "Bajo" : "OK"}
                  </Badge>
                  <span className="text-xs font-bold text-[#F3F7FA]">Stock: {p.stock.toString()}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
