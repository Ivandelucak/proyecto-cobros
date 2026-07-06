import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateSupplierAction } from "../../actions";
import { SupplierForm } from "../../supplier-form";

export const dynamic = "force-dynamic";

type EditarProveedorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarProveedorPage({ params }: EditarProveedorPageProps) {
  const user = await requireAdminPage();
  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({
    where: {
      id,
      businessId: user.businessId!
    }
  });

  if (!supplier) {
    redirect("/proveedores");
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Editar proveedor" description="Actualiza datos de contacto y estado." />
      <SupplierForm
        action={updateSupplierAction.bind(null, supplier.id)}
        submitLabel="Guardar cambios"
        initialValues={supplier}
      />
    </section>
  );
}
