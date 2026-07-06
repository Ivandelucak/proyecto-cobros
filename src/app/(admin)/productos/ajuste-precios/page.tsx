import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PriceAdjustmentForm } from "./price-adjustment-form";

export const dynamic = "force-dynamic";

export default async function AjustePreciosPage() {
  const user = await requireAdminPage();
  const businessId = user.businessId!;

  const [rawCategories, productsWithBrand] = await Promise.all([
    prisma.category.findMany({
      where: {
        businessId,
        active: true
      },
      include: {
        parent: {
          select: {
            name: true
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.product.findMany({
      where: {
        businessId,
        deletedAt: null,
        brand: { not: null }
      },
      select: { brand: true },
      orderBy: { brand: "asc" }
    })
  ]);

  // Construct label showing hierarchy and deduplicate by id
  const categoryOptionsMap = new Map<string, { id: string; name: string }>();
  for (const cat of rawCategories) {
    if (!categoryOptionsMap.has(cat.id)) {
      const displayName = cat.parent ? `${cat.parent.name} > ${cat.name}` : cat.name;
      categoryOptionsMap.set(cat.id, { id: cat.id, name: displayName });
    }
  }

  const categories = Array.from(categoryOptionsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const brands = [
    ...new Set(
      productsWithBrand
        .map((product) => product.brand?.trim())
        .filter((brand): brand is string => Boolean(brand))
    )
  ];

  return (
    <section className="space-y-5">
      <PageHeader
        title="Ajuste de precios"
        description="Aplica aumentos o reducciones porcentuales con preview obligatorio."
      />
      <PriceAdjustmentForm categories={categories} brands={brands} />
    </section>
  );
}
