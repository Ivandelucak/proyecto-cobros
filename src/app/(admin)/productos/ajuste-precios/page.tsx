import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PriceAdjustmentForm } from "./price-adjustment-form";

export const dynamic = "force-dynamic";

export default async function AjustePreciosPage() {
  await requireAdminPage();

  const [categories, productsWithBrand] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        brand: { not: null }
      },
      select: { brand: true },
      orderBy: { brand: "asc" }
    })
  ]);
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
