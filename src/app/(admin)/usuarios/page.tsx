import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { setUserActiveAction } from "./actions";

export const dynamic = "force-dynamic";

type UsuariosPageProps = {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  CASHIER: "Cajero"
};

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const role = params.role ?? "all";
  const status = params.status ?? "active";

  const users = await prisma.user.findMany({
    where: {
      ...(status === "active" ? { active: true } : {}),
      ...(status === "inactive" ? { active: false } : {}),
      ...(role === Role.ADMIN || role === Role.CASHIER ? { role } : {}),
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { email: { contains: q } }]
          }
        : {})
    },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }]
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Usuarios"
        description="Gestion de accesos para administradores y cajeros."
        actions={
          <LinkButton href="/usuarios/nuevo" variant="primary">
            Nuevo usuario
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <Input name="q" placeholder="Buscar por nombre o email" defaultValue={q} />
          <Select name="role" defaultValue={role}>
            <option value="all">Todos los roles</option>
            <option value="ADMIN">Administradores</option>
            <option value="CASHIER">Cajeros</option>
          </Select>
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

      {users.length === 0 ? (
        <EmptyState
          title="No hay usuarios"
          description="Crea usuarios para controlar el acceso al sistema."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Creado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {roleLabels[user.role]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.active ? "green" : "gray"}>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/usuarios/${user.id}/editar`} size="sm">
                          Editar
                        </LinkButton>
                        <form action={setUserActiveAction.bind(null, user.id, !user.active)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant={user.active ? "danger" : "secondary"}
                          >
                            {user.active ? "Desactivar" : "Reactivar"}
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}
