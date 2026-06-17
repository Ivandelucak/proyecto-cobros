import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createProductAction } from "../actions";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  await requireAdminPage();

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

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
