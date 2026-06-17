import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateCategoryAction } from "../../actions";
import { CategoryForm } from "../../category-form";

export const dynamic = "force-dynamic";

type EditarCategoriaPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarCategoriaPage({ params }: EditarCategoriaPageProps) {
  await requireAdminPage();

  const { id } = await params;
  const [category, parentOptions] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findMany({
      where: {
        id: { not: id },
        active: true
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  if (!category) {
    redirect("/categorias");
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Editar categoría"
        description="Actualizá nombre, estado y categoría padre."
      />
      <CategoryForm
        action={updateCategoryAction.bind(null, category.id)}
        parentOptions={parentOptions}
        submitLabel="Guardar cambios"
        initialValues={{
          name: category.name,
          parentId: category.parentId,
          active: category.active
        }}
      />
    </section>
  );
}
