import { Card } from "@/components/ui/card";
import { requireMobileAuth } from "@/lib/admin-auth";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatDateTimeStable } from "@/lib/date-format";

import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";

export const dynamic = "force-dynamic";

export default async function MobileComprasPage() {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const purchases = await prisma.purchase.findMany({
    where: {
      businessId
    },
    include: {
      supplier: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <MobilePageHeader
        title="Ingresos / Compras"
        subtitle="Registro de abastecimiento de mercadería."
        fallbackUrl="/m"
      />

      {/* List */}
      <div className="space-y-2.5">
        {purchases.length === 0 ? (
          <Card className="p-8 text-center bg-[#121922] border-[#273342]">
            <p className="text-xs text-[#A9B6C2]">No hay compras registradas.</p>
          </Card>
        ) : (
          purchases.map((p) => (
            <Card key={p.id} className="p-3.5 bg-[#121922] border-[#273342] flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#F3F7FA]">Compra #{p.purchaseNumber}</span>
                <span className="font-black text-sm text-[#4C7FA3]">{formatARS(p.total)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#A9B6C2]">
                <span>Proveedor: {p.supplier?.name || "Sin proveedor"}</span>
                <span>{formatDateTimeStable(p.createdAt)}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
