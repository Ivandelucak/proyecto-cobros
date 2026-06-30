import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCustomerBalanceMap } from "@/lib/customer-account";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { setCustomerActiveAction } from "./actions";

export const dynamic = "force-dynamic";

type ClientesPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "active";
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...(status === "active" ? { active: true } : {}),
      ...(status === "inactive" ? { active: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { document: { contains: q } },
              { phone: { contains: q } }
            ]
          }
        : {})
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
  const balances = await getCustomerBalanceMap(customers.map((customer) => customer.id));

  return (
    <section className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Gestion de clientes y saldos de cuenta corriente."
        actions={
          <LinkButton href="/clientes/nuevo" variant="primary">
            Nuevo cliente
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <Input name="q" placeholder="Buscar por nombre, documento o telefono" defaultValue={q} />
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

      {customers.length === 0 ? (
        <EmptyState title="No hay clientes" description="Carga un cliente para usar cuenta corriente." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Saldo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {customers.map((customer) => {
                  const balance = balances.get(customer.id) ?? 0;
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">{customer.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                          {customer.document || "Sin documento"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {[customer.phone, customer.email].filter(Boolean).join(" - ") || "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(balance)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={customer.active ? "green" : "gray"}>
                          {customer.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <LinkButton href={`/clientes/${customer.id}`} size="sm">
                            Detalle
                          </LinkButton>
                          <LinkButton href={`/clientes/${customer.id}/editar`} size="sm">
                            Editar
                          </LinkButton>
                          <form action={setCustomerActiveAction.bind(null, customer.id, !customer.active)}>
                            <Button
                              type="submit"
                              size="sm"
                              variant={customer.active ? "danger" : "secondary"}
                            >
                              {customer.active ? "Desactivar" : "Reactivar"}
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
