import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatStock } from "@/lib/stock-format";

export const dynamic = "force-dynamic";

type CompraDetallePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CompraDetallePage({ params }: CompraDetallePageProps) {
  const user = await requireAdminPage();
  const { id } = await params;
  const purchase = await prisma.purchase.findFirst({
    where: {
      id,
      businessId: user.businessId!
    },
    include: {
      supplier: true,
      user: { select: { name: true } },
      items: { include: { product: { select: { unitType: true } } } }
    }
  });

  if (!purchase) {
    notFound();
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={`Compra #${purchase.purchaseNumber}`}
        description={`Registrada el ${formatDateTimeStable(purchase.createdAt)} por ${purchase.user.name}.`}
        actions={<LinkButton href="/compras">Volver</LinkButton>}
      />

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="Proveedor" value={purchase.supplier?.name ?? "Sin proveedor"} />
          <Info label="Estado" value={purchase.status} />
          <Info label="Total" value={formatARS(purchase.total)} />
        </div>
        {purchase.notes ? (
          <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-[#121922] dark:text-[#A9B6C2]">
            {purchase.notes}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Costo</th>
                <th className="px-4 py-3 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                    {item.productNameSnapshot}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                    {formatStock(item.quantity, item.product.unitType)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                    {formatARS(item.unitCost)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                    {formatARS(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-[#7F8D9A]">{label}</p>
      <p className="mt-1 font-medium text-gray-950 dark:text-[#F3F7FA]">{value}</p>
    </div>
  );
}
