import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { setCategoryActiveAction } from "./actions";

export const dynamic = "force-dynamic";

type CategoriasPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function CategoriasPage({ searchParams }: CategoriasPageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const categories = await prisma.category.findMany({
    where: q
      ? {
          name: { contains: q }
        }
      : {},
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true } }
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Categorías"
        description="Organizá productos por rubro y prepará subcategorías para etapas futuras."
        actions={
          <LinkButton href="/categorias/nueva" variant="primary">
            Nueva categoría
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input name="q" placeholder="Buscar categoría" defaultValue={q} />
          <Button type="submit" variant="primary">
            Buscar
          </Button>
        </form>
      </Card>

      {categories.length === 0 ? (
        <EmptyState
          title="No hay categorías para mostrar"
          description="Ajustá la búsqueda o cargá una nueva categoría."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Padre</th>
                <th className="px-4 py-3 font-medium">Productos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                >
                  <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {category.parent?.name ?? "Sin padre"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {category._count.products}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={category.active ? "green" : "gray"}>
                      {category.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/categorias/${category.id}/editar`} size="sm">
                        Editar
                      </LinkButton>
                      <form
                        action={setCategoryActiveAction.bind(
                          null,
                          category.id,
                          !category.active
                        )}
                      >
                        <Button
                          type="submit"
                          size="sm"
                          variant={category.active ? "danger" : "secondary"}
                        >
                          {category.active ? "Desactivar" : "Reactivar"}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
