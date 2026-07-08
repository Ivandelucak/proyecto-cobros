import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MobileProductoDetallePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MobileProductoDetallePage({ params }: MobileProductoDetallePageProps) {
  const user = await requireMobileAuth();
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: {
      id,
      businessId: user.businessId!,
      deletedAt: null
    },
    include: {
      category: { select: { name: true } }
    }
  });

  if (!product) {
    redirect("/m/productos");
  }

  return (
    <div className="space-y-4">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <Link
          href="/m/productos"
          className="p-2 rounded-lg bg-[#121922] border border-[#273342] text-[#A9B6C2] active:text-[#F3F7FA]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-[#F3F7FA]">Detalle del Producto</h2>
          <p className="text-xs text-[#A9B6C2]">Consulta técnica y de valores.</p>
        </div>
      </div>

      {/* Main product card */}
      <Card className="p-5 bg-[#121922] border-[#273342] space-y-4 shadow">
        <div>
          <Badge tone={product.active ? "green" : "red"}>
            {product.active ? "Activo" : "Inactivo"}
          </Badge>
          <h3 className="text-lg font-black text-[#F3F7FA] mt-1.5 leading-tight">{product.name}</h3>
          <p className="text-xs text-[#A9B6C2] mt-0.5">Categoría: {product.category?.name || "Sin categoría"}</p>
        </div>

        <div className="pt-3.5 border-t border-[#273342] grid grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#7F8D9A]">Precio de Venta</span>
            <span className="block text-lg font-black text-[#4C7FA3] mt-0.5">{formatARS(product.salePrice)}</span>
          </div>
          {product.cost && (
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#7F8D9A]">Precio de Costo</span>
              <span className="block text-lg font-bold text-[#A9B6C2] mt-0.5">{formatARS(product.cost)}</span>
            </div>
          )}
        </div>

        <div className="pt-3.5 border-t border-[#273342] grid grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#7F8D9A]">Stock Actual</span>
            <span className={`block text-lg font-black mt-0.5 ${product.stock.lte(product.minStock) ? "text-[#E16060]" : "text-[#28A36A]"}`}>
              {product.stock.toString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#7F8D9A]">Stock Mínimo</span>
            <span className="block text-lg font-bold text-[#F3F7FA] mt-0.5">{product.minStock.toString()}</span>
          </div>
        </div>

        <div className="pt-3.5 border-t border-[#273342] space-y-2">
          {product.sku && (
            <div className="flex justify-between text-xs">
              <span className="text-[#A9B6C2]">SKU</span>
              <span className="font-semibold text-[#F3F7FA]">{product.sku}</span>
            </div>
          )}
          {product.barcode && (
            <div className="flex justify-between text-xs">
              <span className="text-[#A9B6C2]">Código de Barras</span>
              <span className="font-semibold text-[#F3F7FA]">{product.barcode}</span>
            </div>
          )}
          {product.brand && (
            <div className="flex justify-between text-xs">
              <span className="text-[#A9B6C2]">Marca</span>
              <span className="font-semibold text-[#F3F7FA]">{product.brand}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
