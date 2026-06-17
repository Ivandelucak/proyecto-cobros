import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { ImportProductsForm } from "./import-products-form";

export const dynamic = "force-dynamic";

export default async function ImportarProductosPage() {
  await requireAdminPage();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Importar productos"
        description="Subi un archivo Excel, revisa los productos antes de importar y confirma solo las filas validas."
        actions={<LinkButton href="/productos">Volver</LinkButton>}
      />

      <ImportProductsForm />
    </section>
  );
}
