"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  MobileBottomSheet,
  MobileProductCard,
  MobileProductPricingDialog,
  MobileStockAdjustmentDialog,
  type MobileEditableProduct
} from "./MobileProductEditors";

type ProductSheet = "actions" | "stock" | "pricing" | null;

export function MobileProductsList({ products }: { products: MobileEditableProduct[] }) {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<MobileEditableProduct | null>(null);
  const [sheet, setSheet] = useState<ProductSheet>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const closeSheet = () => {
    setSheet(null);
  };

  const openActions = (product: MobileEditableProduct) => {
    setSelectedProduct(product);
    setSheet("actions");
  };

  const saved = (message: string) => {
    setFeedback(message);
    setSheet(null);
    router.refresh();
  };

  return (
    <>
      <div className="space-y-2.5">
        {products.map((product) => (
          <MobileProductCard key={product.id} product={product} onOpenActions={openActions} />
        ))}
      </div>

      <MobileBottomSheet
        open={sheet === "actions" && Boolean(selectedProduct)}
        title="Acciones del producto"
        description={selectedProduct?.name}
        onClose={closeSheet}
        compact
      >
        <div className="grid gap-2">
          <Button type="button" variant="outline" className="justify-start" onClick={() => setSheet("stock")}>
            Actualizar stock
          </Button>
          <Button type="button" variant="outline" className="justify-start" onClick={() => setSheet("pricing")}>
            Editar precio y costo
          </Button>
        </div>
      </MobileBottomSheet>

      <MobileStockAdjustmentDialog
        product={selectedProduct}
        open={sheet === "stock"}
        onClose={closeSheet}
        onSaved={saved}
      />
      <MobileProductPricingDialog
        product={selectedProduct}
        open={sheet === "pricing"}
        onClose={closeSheet}
        onSaved={saved}
      />
      {feedback ? <p role="status" className="sr-only">{feedback}</p> : null}
    </>
  );
}
