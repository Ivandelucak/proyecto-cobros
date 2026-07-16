import { Card } from "@/components/ui/card";
import { requireMobileAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";
import { MobileStockFilters } from "@/components/mobile/MobileStockFilters";
import { MobileStockList } from "@/components/mobile/MobileStockList";

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
          <MobileStockList
            products={visibleProducts.map((product) => ({
              id: product.id,
              name: product.name,
              stock: product.stock.toString(),
              minStock: product.minStock.toString(),
              salePrice: product.salePrice.toString(),
              cost: product.cost?.toString() ?? null,
              unitType: product.unitType,
              allowsDecimalQuantity: product.allowsDecimalQuantity,
              categoryName: product.category?.name
            }))}
          />
        )}
      </div>
    </div>
  );
}
