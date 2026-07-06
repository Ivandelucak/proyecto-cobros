import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ProveedorDetallePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProveedorDetallePage({ params }: ProveedorDetallePageProps) {
  const user = await requireAdminPage();
  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({
    where: {
      id,
      businessId: user.businessId!
    },
    include: {
      purchases: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!supplier) {
    notFound();
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={supplier.name}
        description="Detalle del proveedor y compras asociadas."
        actions={
          <>
            <LinkButton href="/proveedores">Volver</LinkButton>
            <LinkButton href={`/proveedores/${supplier.id}/editar`} variant="primary">
              Editar
            </LinkButton>
          </>
        }
      />

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="CUIT" value={supplier.cuit} />
          <Info label="Telefono" value={supplier.phone} />
          <Info label="Email" value={supplier.email} />
          <Info label="Direccion" value={supplier.address} />
          <Info label="Estado" value={supplier.active ? "Activo" : "Inactivo"} />
        </div>
        {supplier.notes ? (
          <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-[#121922] dark:text-[#A9B6C2]">
            {supplier.notes}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-[#273342]">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
            Compras asociadas
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
          {supplier.purchases.length === 0 ? (
            <p className="p-5 text-sm text-gray-500 dark:text-[#7F8D9A]">
              Sin compras registradas.
            </p>
          ) : (
            supplier.purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                    Compra #{purchase.purchaseNumber}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                    {formatDateTimeStable(purchase.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-950 dark:text-[#F3F7FA]">
                    {formatARS(purchase.total)}
                  </p>
                  <LinkButton href={`/compras/${purchase.id}`} size="sm">
                    Ver
                  </LinkButton>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-[#7F8D9A]">{label}</p>
      <p className="mt-1 font-medium text-gray-950 dark:text-[#F3F7FA]">{value || "-"}</p>
    </div>
  );
}
