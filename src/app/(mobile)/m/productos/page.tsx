import { Card } from "@/components/ui/card";
import { requireMobileAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";
import { MobileProductsFilters } from "@/components/mobile/MobileProductsFilters";
import { MobileProductCard } from "@/components/mobile/MobileProductEditors";

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
          products.map((product) => (
            <MobileProductCard
              key={product.id}
              product={{
                id: product.id,
                name: product.name,
                stock: product.stock.toString(),
                minStock: product.minStock.toString(),
                salePrice: product.salePrice.toString(),
                cost: product.cost?.toString() ?? null,
                unitType: product.unitType,
                allowsDecimalQuantity: product.allowsDecimalQuantity,
                categoryName: product.category?.name
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
