import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateUserAction } from "../../actions";
import { UserForm } from "../../user-form";

export const dynamic = "force-dynamic";

type EditarUsuarioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarUsuarioPage({ params }: EditarUsuarioPageProps) {
  const currentUser = await requireAdminPage();

  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: {
      id,
      businessId: currentUser.businessId!
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true
    }
  });

  if (!user) {
    redirect("/usuarios");
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Editar usuario"
        description="Actualiza rol, estado y credenciales de acceso."
      />
      <UserForm
        action={updateUserAction.bind(null, user.id)}
        submitLabel="Guardar cambios"
        initialValues={{
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active
        }}
      />
    </section>
  );
}
