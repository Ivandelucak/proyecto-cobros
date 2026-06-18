import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";

export const dynamic = "force-dynamic";

export default async function NuevoClientePage() {
  await requireAdminPage();

  return (
    <section className="space-y-5">
      <PageHeader title="Nuevo cliente" description="Datos basicos para ventas y cuenta corriente." />
      <CustomerForm action={createCustomerAction} submitLabel="Crear cliente" />
    </section>
  );
}
