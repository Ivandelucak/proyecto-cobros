import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { setSupplierActiveAction } from "./actions";

export const dynamic = "force-dynamic";

type ProveedoresPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function ProveedoresPage({ searchParams }: ProveedoresPageProps) {
  const user = await requireAdminPage();
  const businessId = user.businessId!;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "active";
  const suppliers = await prisma.supplier.findMany({
    where: {
      businessId,
      ...(status === "active" ? { active: true } : {}),
      ...(status === "inactive" ? { active: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { cuit: { contains: q } },
              { phone: { contains: q } }
            ]
          }
        : {})
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Proveedores"
        description="Gestion de proveedores para compras e ingreso de mercaderia."
        actions={
          <LinkButton href="/proveedores/nuevo" variant="primary">
            Nuevo proveedor
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <Input name="q" placeholder="Buscar por nombre, CUIT o telefono" defaultValue={q} />
          <Select name="status" defaultValue={status}>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
      </Card>

      {suppliers.length === 0 ? (
        <EmptyState title="No hay proveedores" description="Carga proveedores para registrar compras." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">{supplier.name}</p>
                      <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                        {supplier.cuit || "Sin CUIT"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {[supplier.phone, supplier.email].filter(Boolean).join(" - ") || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={supplier.active ? "green" : "gray"}>
                        {supplier.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/proveedores/${supplier.id}`} size="sm">
                          Detalle
                        </LinkButton>
                        <LinkButton href={`/proveedores/${supplier.id}/editar`} size="sm">
                          Editar
                        </LinkButton>
                        <form action={setSupplierActiveAction.bind(null, supplier.id, !supplier.active)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant={supplier.active ? "danger" : "secondary"}
                          >
                            {supplier.active ? "Desactivar" : "Reactivar"}
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
