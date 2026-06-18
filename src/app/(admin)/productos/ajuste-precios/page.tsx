import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PriceAdjustmentForm } from "./price-adjustment-form";

export const dynamic = "force-dynamic";

export default async function AjustePreciosPage() {
  await requireAdminPage();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Ajuste de precios"
        description="Aplica aumentos o reducciones porcentuales con preview obligatorio."
      />
      <PriceAdjustmentForm categories={categories} />
    </section>
  );
}
