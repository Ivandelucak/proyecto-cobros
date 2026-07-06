import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AuditoriaPageProps = {
  searchParams: Promise<{ q?: string; entity?: string }>;
};

export default async function AuditoriaPage({ searchParams }: AuditoriaPageProps) {
  const user = await requireAdminPage();
  const businessId = user.businessId!;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const entity = params.entity ?? "all";

  const [logs, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        businessId,
        ...(entity !== "all" ? { entity } : {}),
        ...(q
          ? {
              OR: [
                { action: { contains: q } },
                { entity: { contains: q } },
                { description: { contains: q } },
                { user: { name: { contains: q } } },
                { user: { email: { contains: q } } }
              ]
            }
          : {})
      },
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.auditLog.findMany({
      where: { businessId },
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" }
    })
  ]);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Auditoria"
        description="Registro basico de operaciones relevantes del sistema."
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <Input name="q" placeholder="Buscar accion, usuario o detalle" defaultValue={q} />
          <Select name="entity" defaultValue={entity}>
            <option value="all">Todas las entidades</option>
            {entities.map((entry) => (
              <option key={entry.entity} value={entry.entity}>
                {entry.entity}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          description="Las operaciones auditadas apareceran en este listado."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Accion</th>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                  <th className="px-4 py-3 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60">
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {log.user?.name ?? "Sistema"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                        {log.user?.email ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {log.entity}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {log.description}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs text-gray-500 dark:text-[#7F8D9A]">
                      {log.metadata ? JSON.stringify(log.metadata) : "-"}
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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
