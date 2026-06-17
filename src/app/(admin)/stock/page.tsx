import { PagePlaceholder } from "@/components/page-placeholder";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function StockPage() {
  await requireAdminPage();

  return (
    <PagePlaceholder
      title="Stock"
      description="Consulta de stock actual, stock bajo y movimientos de inventario."
    />
  );
}
