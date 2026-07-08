import Link from "next/link";
import { requireMobileAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { QuoteBuilder } from "./quote-builder";

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
      <div className="flex items-center gap-3">
        <Link
          href="/m/presupuestos"
          className="p-2 rounded-lg bg-[#121922] border border-[#273342] text-[#A9B6C2] active:text-[#F3F7FA]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-[#F3F7FA]">Nuevo Presupuesto</h2>
          <p className="text-xs text-[#A9B6C2]">Crear cotización sin alterar stock.</p>
        </div>
      </div>

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
