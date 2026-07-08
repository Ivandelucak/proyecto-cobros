import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MobileCategoriasPage() {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const categories = await prisma.category.findMany({
    where: {
      businessId
    },
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#F3F7FA]">Categorías</h2>
        <p className="text-xs text-[#A9B6C2]">Estructura de agrupación de productos.</p>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {categories.length === 0 ? (
          <Card className="p-8 text-center bg-[#121922] border-[#273342]">
            <p className="text-xs text-[#A9B6C2]">No hay categorías cargadas.</p>
          </Card>
        ) : (
          categories.map((c) => (
            <Card key={c.id} className="p-3.5 bg-[#121922] border-[#273342] flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm text-[#F3F7FA]">{c.name}</h4>
                {c.parent && (
                  <p className="text-[10px] text-[#7F8D9A] mt-0.5">
                    Subcategoría de: {c.parent.name}
                  </p>
                )}
              </div>
              <div className="text-right flex items-center gap-2">
                <Badge tone={c.active ? "green" : "red"}>
                  {c.active ? "Activa" : "Inactiva"}
                </Badge>
                <span className="text-[11px] text-[#A9B6C2] font-semibold bg-[#1D3140] px-2 py-0.5 rounded">
                  {c._count.products} prods
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
