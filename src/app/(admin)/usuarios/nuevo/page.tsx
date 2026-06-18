import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { createUserAction } from "../actions";
import { UserForm } from "../user-form";

export const dynamic = "force-dynamic";

export default async function NuevoUsuarioPage() {
  await requireAdminPage();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Nuevo usuario"
        description="Alta de administradores o cajeros para operar el sistema."
      />
      <UserForm action={createUserAction} submitLabel="Crear usuario" />
    </section>
  );
}
