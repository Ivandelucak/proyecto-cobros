"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MobileStockAdjustmentDialog, type MobileEditableProduct } from "./MobileProductEditors";

export function MobileStockList({ products }: { products: MobileEditableProduct[] }) {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<MobileEditableProduct | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-2.5">
        {products.map((product) => {
          const stock = Number(product.stock);
          const minimum = Number(product.minStock);
          const out = stock <= 0;
          const low = stock < minimum;

          return (
            <article key={product.id} className="rounded-xl border border-[#273342] bg-[#121922] p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-[#F3F7FA]">{product.name}</h4>
                  <p className="mt-0.5 text-[10px] text-[#7F8D9A]">Minimo: {product.minStock} · Cat: {product.categoryName || "Sin cat"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={out ? "red" : low ? "amber" : "green"}>{out ? "Sin stock" : low ? "Bajo" : "OK"}</Badge>
                  <span className="text-xs font-bold text-[#F3F7FA]">Stock: {product.stock}</span>
                  <button
                    type="button"
                    aria-label={`Ajustar stock de ${product.name}`}
                    onClick={() => setSelectedProduct(product)}
                    className="min-h-10 rounded-lg border border-[#344657] bg-[#1D3140] px-3 text-xs font-bold text-[#D6E4EE] transition-colors hover:bg-[#263C4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]"
                  >
                    Ajustar
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <MobileStockAdjustmentDialog
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onSaved={(message) => {
          setFeedback(message);
          router.refresh();
        }}
      />
      {feedback ? <p role="status" className="sr-only">{feedback}</p> : null}
    </>
  );
}
