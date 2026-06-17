import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createCategoryAction } from "../actions";
import { CategoryForm } from "../category-form";

export const dynamic = "force-dynamic";

export default async function NuevaCategoriaPage() {
  await requireAdminPage();

  const parentOptions = await prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Nueva categoría"
        description="Creá una categoría simple o vinculala a una categoría padre."
      />
      <CategoryForm
        action={createCategoryAction}
        parentOptions={parentOptions}
        submitLabel="Crear categoría"
      />
    </section>
  );
}
