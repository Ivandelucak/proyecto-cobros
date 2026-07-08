import { UnitType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyText } from "@/components/ui/currency-text";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOperationalUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatStock, shouldUseDecimalQuantity } from "@/lib/stock-format";
import { setProductActiveAction } from "./actions";
import { ProductsBarcodeFilter } from "./products-barcode-filter";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    quickAccess?: string;
    stock?: string;
    barcode?: string;
  }>;
};

export default async function ProductosPage({ searchParams }: ProductsPageProps) {
  const user = await requireOperationalUser();
  const businessId = user.businessId!;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const categoryId = params.categoryId ?? "";
  const status = params.status ?? "active";
  const quickAccess = params.quickAccess ?? "all";
  const stockFilter = params.stock ?? "all";
  const barcode = params.barcode?.trim() ?? "";

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.product.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(status === "active" ? { active: true } : {}),
        ...(status === "inactive" ? { active: false } : {}),
        ...(quickAccess === "yes" ? { quickAccess: true } : {}),
        ...(quickAccess === "no" ? { quickAccess: false } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(barcode
          ? { barcode }
          : q
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
        category: {
          select: { name: true }
        }
      },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }]
    })
  ]);
  const visibleProducts = products.filter((product) => {
    if (stockFilter === "low") {
      return product.stock.lte(product.minStock);
    }

    if (stockFilter === "out") {
      return product.stock.lte(0);
    }

    if (stockFilter === "noBarcode") {
      return !product.barcode;
    }

    return true;
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Productos"
        description="Listado y administracion de productos, precios, unidades y estado."
        actions={
          <>
            <LinkButton href="/productos/plantilla">Plantilla</LinkButton>
            <LinkButton href="/productos/importar">Importar Excel</LinkButton>
            <LinkButton href="/productos/exportar">Exportar</LinkButton>
            <LinkButton href="/productos/ajuste-precios">Ajuste de precios</LinkButton>
            <LinkButton href="/productos/nuevo" variant="primary">
              Nuevo producto
            </LinkButton>
          </>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(220px,1fr)_210px_150px_170px_170px_auto]">
          <Input
            name="q"
            placeholder="Buscar por nombre, codigo o SKU"
            defaultValue={q}
          />
          <Select name="categoryId" defaultValue={categoryId}>
            <option value="">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status}>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </Select>
          <Select name="quickAccess" defaultValue={quickAccess}>
            <option value="all">Todos los accesos</option>
            <option value="yes">Acceso rapido</option>
            <option value="no">Sin acceso rapido</option>
          </Select>
          <Select name="stock" defaultValue={stockFilter}>
            <option value="all">Todo stock</option>
            <option value="low">Stock bajo</option>
            <option value="out">Sin stock</option>
            <option value="noBarcode">Sin codigo</option>
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
        <div className="mt-3">
          <ProductsBarcodeFilter scannedCode={barcode} />
        </div>
      </Card>

      {visibleProducts.length === 0 ? (
        <EmptyState
          title="No hay productos para mostrar"
          description={
            barcode
              ? "No se encontro producto con ese codigo de barras."
              : "Ajusta los filtros o carga un nuevo producto."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Unidad</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {visibleProducts.map((product) => {
                  const stockLow = product.stock.lte(product.minStock);
                  const stockOut = product.stock.lte(0);
                  const isWeighted =
                    product.allowsDecimalQuantity || shouldUseDecimalQuantity(product.unitType);

                  return (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                          {product.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-[#7F8D9A]">
                          {[product.barcode, product.sku].filter(Boolean).join(" - ") ||
                            "Sin codigo"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {product.quickAccess ? (
                            <Badge tone="blue">Acceso rapido</Badge>
                          ) : null}
                          {isWeighted ? <Badge tone="amber">Venta decimal</Badge> : null}
                          {!product.barcode ? <Badge tone="gray">Sin codigo</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {product.category.name}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                        <CurrencyText value={product.salePrice} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800 dark:text-[#F3F7FA]">
                            {formatStock(product.stock, product.unitType)}
                          </span>
                          {stockOut ? (
                            <Badge tone="red">Sin stock</Badge>
                          ) : stockLow ? (
                            <Badge tone="amber">Bajo</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {unitLabel(product.unitType)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={product.active ? "green" : "gray"}>
                          {product.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <LinkButton href={`/productos/${product.id}/editar`} size="sm">
                            Editar
                          </LinkButton>
                          <form
                            action={setProductActiveAction.bind(
                              null,
                              product.id,
                              !product.active
                            )}
                          >
                            <Button
                              type="submit"
                              size="sm"
                              variant={product.active ? "danger" : "secondary"}
                            >
                              {product.active ? "Desactivar" : "Reactivar"}
                            </Button>
                          </form>
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

function unitLabel(unitType: UnitType) {
  const labels: Record<UnitType, string> = {
    UNIT: "Unidad",
    KG: "Kg",
    GR: "Gr",
    LITER: "Litro",
    METER: "Metro",
    PACK: "Pack",
    BOX: "Caja",
    OTHER: "Otro"
  };

  return labels[unitType];
}
