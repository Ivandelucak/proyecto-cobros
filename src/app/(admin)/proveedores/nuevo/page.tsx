import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { createSupplierAction } from "../actions";
import { SupplierForm } from "../supplier-form";

export const dynamic = "force-dynamic";

export default async function NuevoProveedorPage() {
  await requireAdminPage();

  return (
    <section className="space-y-5">
      <PageHeader title="Nuevo proveedor" description="Datos basicos para compras." />
      <SupplierForm action={createSupplierAction} submitLabel="Crear proveedor" />
    </section>
  );
}
