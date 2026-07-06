import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateCustomerAction } from "../../actions";
import { CustomerForm } from "../../customer-form";

export const dynamic = "force-dynamic";

type EditarClientePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarClientePage({ params }: EditarClientePageProps) {
  const user = await requireAdminPage();
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: {
      id,
      businessId: user.businessId!
    }
  });

  if (!customer) {
    redirect("/clientes");
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Editar cliente" description="Actualiza datos de contacto y estado." />
      <CustomerForm
        action={updateCustomerAction.bind(null, customer.id)}
        submitLabel="Guardar cambios"
        initialValues={customer}
      />
    </section>
  );
}
