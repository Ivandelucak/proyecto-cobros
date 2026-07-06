import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createProductAction } from "../actions";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const user = await requireAdminPage();

  const rawCategories = await prisma.category.findMany({
    where: {
      businessId: user.businessId!,
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
  });

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

  return (
    <section className="space-y-5">
      <PageHeader
        title="Nuevo producto"
        description="Cargá los datos principales para vender y controlar stock."
      />
      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Crear producto"
      />
    </section>
  );
}
