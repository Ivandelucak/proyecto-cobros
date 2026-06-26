import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatStock } from "@/lib/stock-format";
import { StockBarcodeFilter } from "./stock-barcode-filter";

export const dynamic = "force-dynamic";

type StockPageProps = {
  searchParams: Promise<{ categoryId?: string; filter?: string; q?: string; barcode?: string }>;
};

export default async function StockPage({ searchParams }: StockPageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const categoryId = params.categoryId ?? "";
  const filter = params.filter ?? "low";
  const q = params.q?.trim() ?? "";
  const barcode = params.barcode?.trim() ?? "";
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.product.findMany({
      where: {
        active: true,
        deletedAt: null,
        ...(categoryId ? { categoryId } : {}),
        ...(barcode
          ? { barcode }
          : q
            ? {
                OR: [
                  { name: { contains: q } },
                  { barcode: { contains: q } },
                  { sku: { contains: q } },
                  { brand: { contains: q } }
                ]
              }
            : {})
      },
      include: { category: { select: { name: true } } },
      orderBy: { stock: "asc" }
    })
  ]);

  const visibleProducts = products.filter((product) => {
    if (filter === "out") {
      return product.stock.lte(0);
    }
    if (filter === "all") {
      return true;
    }
    return product.stock.lt(product.minStock);
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Stock"
        description="Reposicion de stock bajo, sin stock y sugerencias simples."
        actions={
          <LinkButton href="/compras/nueva" variant="primary">
            Crear compra
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,220px)_180px_auto]">
          <Input name="q" defaultValue={q} placeholder="Producto, SKU o codigo" />
          <Select name="categoryId" defaultValue={categoryId}>
            <option value="">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select name="filter" defaultValue={filter}>
            <option value="low">Stock bajo</option>
            <option value="out">Sin stock</option>
            <option value="all">Todos</option>
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
        <div className="mt-3">
          <StockBarcodeFilter scannedCode={barcode} />
        </div>
      </Card>

      {visibleProducts.length === 0 ? (
        <EmptyState
          title="Sin alertas de stock"
          description={
            barcode
              ? "No se encontro producto con ese codigo."
              : "No hay productos para el filtro seleccionado."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Actual</th>
                  <th className="px-4 py-3 font-medium">Minimo</th>
                  <th className="px-4 py-3 font-medium">Reposicion sugerida</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {visibleProducts.map((product) => {
                  const suggestion = product.stock.lt(product.minStock)
                    ? product.minStock.minus(product.stock)
                    : new Prisma.Decimal(0);
                  const out = product.stock.lte(0);

                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-950 dark:text-gray-50">{product.name}</p>
                        {out ? <Badge tone="red">Sin stock</Badge> : <Badge tone="amber">Bajo</Badge>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {product.category.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {formatStock(product.stock, product.unitType)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {formatStock(product.minStock, product.unitType)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-950 dark:text-gray-50">
                        {formatStock(suggestion, product.unitType)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <LinkButton href="/compras/nueva" size="sm">
                            Crear compra
                          </LinkButton>
                          <LinkButton href={`/productos/${product.id}/editar`} size="sm">
                            Ajustar stock
                          </LinkButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
