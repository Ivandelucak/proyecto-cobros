import { PurchaseStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const user = await requireAdminPage();
  const businessId = user.businessId!;

  const purchases = await prisma.purchase.findMany({
    where: { businessId },
    include: {
      supplier: { select: { name: true } },
      user: { select: { name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Compras"
        description="Ingreso de mercaderia y actualizacion de stock."
        actions={
          <LinkButton href="/compras/nueva" variant="primary">
            Nueva compra
          </LinkButton>
        }
      />

      {purchases.length === 0 ? (
        <EmptyState title="No hay compras" description="Registra una compra para ingresar mercaderia." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3 font-medium">Compra</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                        #{purchase.purchaseNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                        {formatDateTimeStable(purchase.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {purchase.supplier?.name ?? "Sin proveedor"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {purchase.user.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                      {purchase._count.items}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-950 dark:text-[#F3F7FA]">
                      {formatARS(purchase.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={purchase.status === PurchaseStatus.RECEIVED ? "green" : "red"}>
                        {purchase.status === PurchaseStatus.RECEIVED ? "Recibida" : "Anulada"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LinkButton href={`/compras/${purchase.id}`} size="sm">
                        Detalle
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
