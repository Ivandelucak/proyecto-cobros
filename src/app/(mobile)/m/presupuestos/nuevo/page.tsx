import Link from "next/link";
import { requireMobileAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { QuoteBuilder } from "./quote-builder";

import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";

export const dynamic = "force-dynamic";

export default async function MobileNuevoPresupuestoPage() {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const products = await prisma.product.findMany({
    where: {
      businessId,
      active: true,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      salePrice: true,
      unitType: true
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-4">
      {/* Title */}
      <MobilePageHeader
        title="Nuevo Presupuesto"
        subtitle="Crear cotización sin alterar stock."
        fallbackUrl="/m/presupuestos"
      />

      <QuoteBuilder
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          salePrice: p.salePrice.toNumber(),
          unitType: p.unitType
        }))}
      />
    </div>
  );
}
