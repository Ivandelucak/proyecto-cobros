import { PageHeader } from "@/components/ui/page-header";
import { requireOperationalUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createPurchaseAction } from "../actions";
import { PurchaseForm } from "../purchase-form";

export const dynamic = "force-dynamic";

export default async function NuevaCompraPage() {
  await requireOperationalUser();

  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cost: true, stock: true }
    }),
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Nueva compra"
        description="Registra ingreso de mercaderia y actualiza stock."
      />
      <PurchaseForm
        action={createPurchaseAction}
        suppliers={suppliers}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          cost: product.cost?.toString() ?? "0",
          stock: product.stock.toString()
        }))}
      />
    </section>
  );
}
