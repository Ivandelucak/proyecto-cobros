import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireMobileAuth } from "@/lib/admin-auth";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";
import { MobileProductsFilters } from "@/components/mobile/MobileProductsFilters";

export const dynamic = "force-dynamic";

type ProductosMobilePageProps = {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
  }>;
};

export default async function MobileProductosPage({ searchParams }: ProductosMobilePageProps) {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const categoryId = params.categoryId ?? "";

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(categoryId ? { categoryId } : {}),
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
    }),
    prisma.category.findMany({
      where: { businessId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <MobilePageHeader
        title="Listado de Productos"
        subtitle="Consulta rápida de precios y stock."
        fallbackUrl="/m"
      />

      {/* Filters form */}
      <MobileProductsFilters
        categories={categories}
        initialQ={q}
        initialCategoryId={categoryId}
      />

      {/* List */}
      <div className="space-y-2.5">
        {products.length === 0 ? (
          <Card className="p-8 text-center bg-[#121922] border-[#273342]">
            <p className="text-xs text-[#A9B6C2]">No se encontraron productos.</p>
          </Card>
        ) : (
          products.map((p) => (
            <Link key={p.id} href={`/m/productos/${p.id}`} className="block">
              <Card className="p-3.5 bg-[#121922] border-[#273342] hover:border-[#4C7FA3]/50 flex justify-between items-center transition-all">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-[#F3F7FA] truncate">{p.name}</h4>
                  <p className="text-[10px] text-[#7F8D9A] mt-0.5">
                    Categoría: {p.category?.name || "Sin categoría"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block font-black text-sm text-[#4C7FA3]">{formatARS(p.salePrice)}</span>
                  <span className="text-[10px] font-bold text-[#A9B6C2]">Stock: {p.stock.toString()}</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
