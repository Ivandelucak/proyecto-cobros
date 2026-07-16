"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { adjustMobileProductStockAction, updateMobileProductPricingAction } from "@/app/(mobile)/m/productos/actions";
import { Button } from "@/components/ui/button";
import { formatARS } from "@/lib/money";
import { MobileIcon } from "./MobileIcon";

export type MobileEditableProduct = {
  id: string;
  name: string;
  stock: string;
  minStock: string;
  salePrice: string;
  cost: string | null;
  unitType: string;
  allowsDecimalQuantity: boolean;
  categoryName?: string | null;
};

export function MobileStockAdjustmentDialog({
  product,
  open,
  onClose,
  onSaved,
  restoreFocusRef
}: {
  product: MobileEditableProduct | null;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stock, setStock] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();
  const productId = product?.id;
  const productStock = product?.stock ?? "";

  useEffect(() => {
    if (!open || !productId) return;
    const timer = window.setTimeout(() => {
      setStock(productStock);
      setReason("");
      setError(null);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, productId, productStock]);

  const close = () => {
    if (isSaving) return;
    onClose();
    window.setTimeout(() => restoreFocusRef?.current?.focus(), 0);
  };
  const currentStock = product ? parseMobileNumber(product.stock) ?? 0 : 0;
  const nextStock = parseMobileNumber(stock);
  const difference = nextStock === null ? null : nextStock - currentStock;

  return (
    <MobileBottomSheet
      open={open && Boolean(product)}
      title="Ajustar stock"
      description={product?.name}
      onClose={close}
      focusCloseOnOpen={false}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[#273342] bg-[#0B1015] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#7F8D9A]">Stock actual</p>
          <p className="mt-1 text-xl font-black text-[#F3F7FA]">{product?.stock ?? "-"}</p>
        </div>
        <label className="block">
          <span className="text-sm font-bold text-[#D6E4EE]">Nuevo stock</span>
          <input
            ref={inputRef}
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            type="text"
            inputMode={product?.allowsDecimalQuantity ? "decimal" : "numeric"}
            pattern={product?.allowsDecimalQuantity ? "[0-9.,-]*" : "[0-9-]*"}
            className="mt-1.5 min-h-12 w-full rounded-lg border border-[#344657] bg-[#0B1015] px-3 text-base font-bold text-[#F3F7FA] outline-none placeholder:text-[#7F8D9A] focus:border-[#4C7FA3] focus:ring-2 focus:ring-[#4C7FA3]/25"
          />
        </label>
        <div className="flex items-center justify-between rounded-lg border border-[#273342] bg-[#121922] px-3 py-2.5 text-sm">
          <span className="text-[#A9B6C2]">Diferencia</span>
          <strong className={difference === null ? "text-[#E16060]" : difference > 0 ? "text-[#6ED4A4]" : difference < 0 ? "text-[#F2B36D]" : "text-[#F3F7FA]"}>
            {difference === null ? "Valor invalido" : `${difference > 0 ? "+" : ""}${formatQuantity(difference)}`}
          </strong>
        </div>
        <label className="block">
          <span className="text-sm font-bold text-[#D6E4EE]">Motivo u observacion <span className="font-normal text-[#7F8D9A]">(opcional)</span></span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={240}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[#344657] bg-[#0B1015] px-3 text-sm text-[#F3F7FA] outline-none focus:border-[#4C7FA3] focus:ring-2 focus:ring-[#4C7FA3]/25"
          />
        </label>
        {error ? <p role="alert" className="rounded-lg border border-[#E16060]/50 bg-[#4A171B]/50 px-3 py-2 text-sm text-[#FFD7D7]">{error}</p> : null}
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-[#273342] bg-[#121922] pt-3">
          <Button type="button" variant="outline" onClick={close} disabled={isSaving}>Cancelar</Button>
          <Button
            type="button"
            variant="primary"
            disabled={isSaving || !product || difference === null}
            onClick={() => {
              if (!product) return;
              setError(null);
              startTransition(async () => {
                const result = await adjustMobileProductStockAction({ productId: product.id, stock, reason });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onSaved(result.message);
                onClose();
              });
            }}
          >
            {isSaving ? "Guardando..." : "Guardar stock"}
          </Button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

export function MobileProductPricingDialog({
  product,
  open,
  onClose,
  onSaved,
  restoreFocusRef
}: {
  product: MobileEditableProduct | null;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const priceRef = useRef<HTMLInputElement>(null);
  const [cost, setCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [increase, setIncrease] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();
  const productId = product?.id;
  const productCost = product?.cost ?? "";
  const productSalePrice = product?.salePrice ?? "";

  useEffect(() => {
    if (!open || !productId) return;
    const timer = window.setTimeout(() => {
      setCost(productCost);
      setSalePrice(productSalePrice);
      setIncrease("");
      setError(null);
      priceRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, productCost, productId, productSalePrice]);

  const close = () => {
    if (isSaving) return;
    onClose();
    window.setTimeout(() => restoreFocusRef?.current?.focus(), 0);
  };
  const originalPrice = product ? parseMobileNumber(product.salePrice) : null;
  const increaseValue = parseMobileNumber(increase);
  const calculatedPrice = originalPrice !== null && increaseValue !== null && increaseValue >= 0
    ? roundMoney(originalPrice * (1 + increaseValue / 100))
    : null;

  return (
    <MobileBottomSheet open={open && Boolean(product)} title="Editar precio y costo" description={product?.name} onClose={close} focusCloseOnOpen={false}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-bold text-[#D6E4EE]">Costo</span>
          <input
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            inputMode="decimal"
            placeholder="Sin costo cargado"
            className="mt-1.5 min-h-12 w-full rounded-lg border border-[#344657] bg-[#0B1015] px-3 text-base font-bold text-[#F3F7FA] outline-none placeholder:text-[#7F8D9A] focus:border-[#4C7FA3] focus:ring-2 focus:ring-[#4C7FA3]/25"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-[#D6E4EE]">Precio de venta</span>
          <input
            ref={priceRef}
            value={salePrice}
            onChange={(event) => { setSalePrice(event.target.value); setIncrease(""); }}
            inputMode="decimal"
            className="mt-1.5 min-h-12 w-full rounded-lg border border-[#344657] bg-[#0B1015] px-3 text-base font-bold text-[#F3F7FA] outline-none focus:border-[#4C7FA3] focus:ring-2 focus:ring-[#4C7FA3]/25"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-[#D6E4EE]">Aumento porcentual</span>
          <div className="mt-1.5 flex overflow-hidden rounded-lg border border-[#344657] bg-[#0B1015] focus-within:border-[#4C7FA3] focus-within:ring-2 focus-within:ring-[#4C7FA3]/25">
            <input
              value={increase}
              onChange={(event) => {
                const nextIncrease = event.target.value;
                setIncrease(nextIncrease);
                const percent = parseMobileNumber(nextIncrease);
                if (originalPrice !== null && percent !== null && percent >= 0) {
                  setSalePrice(formatInputMoney(roundMoney(originalPrice * (1 + percent / 100))));
                }
              }}
              inputMode="decimal"
              min="0"
              className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base font-bold text-[#F3F7FA] outline-none"
            />
            <span className="grid w-11 place-items-center border-l border-[#344657] text-sm font-black text-[#A9B6C2]">%</span>
          </div>
          <p className="mt-1.5 text-xs text-[#7F8D9A]">Se calcula sobre el precio original al abrir esta ventana.</p>
        </label>
        <div className="rounded-lg border border-[#2F8B64]/45 bg-[#123025]/45 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8CB7A0]">Nuevo precio calculado</p>
          <p className="mt-1 text-xl font-black text-[#F3F7FA]">{calculatedPrice === null ? formatARS(salePrice || 0) : formatARS(calculatedPrice)}</p>
        </div>
        {error ? <p role="alert" className="rounded-lg border border-[#E16060]/50 bg-[#4A171B]/50 px-3 py-2 text-sm text-[#FFD7D7]">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button type="button" variant="outline" onClick={close} disabled={isSaving}>Cancelar</Button>
          <Button
            type="button"
            variant="primary"
            disabled={isSaving}
            onClick={() => {
              if (!product) return;
              setError(null);
              startTransition(async () => {
                const result = await updateMobileProductPricingAction({ productId: product.id, salePrice, cost });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onSaved(result.message);
                onClose();
              });
            }}
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

export function MobileProductCard({ product, onOpenActions }: { product: MobileEditableProduct; onOpenActions: (product: MobileEditableProduct) => void }) {
  return (
    <article className="rounded-xl border border-[#273342] bg-[#121922] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Link href={`/m/productos/${product.id}`} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">
          <h4 className="truncate text-[15px] font-bold text-[#F3F7FA]">{product.name}</h4>
          <p className="mt-0.5 text-xs text-[#7F8D9A]">Categoria: {product.categoryName || "Sin categoria"}</p>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <span className="text-[15px] font-black text-[#4C7FA3]">{formatARS(product.salePrice)}</span>
            <span className="text-xs font-bold text-[#A9B6C2]">Stock: {product.stock}</span>
          </div>
        </Link>
        <button
          type="button"
          aria-label="Acciones del producto"
          onClick={() => onOpenActions(product)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#344657] bg-[#0F151D] text-[#A9B6C2] transition-colors hover:bg-[#1D3140] hover:text-[#F3F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]"
        >
          <MobileIcon name="more" className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

export function MobileBottomSheet({ open, title, description, onClose, children, compact = false, focusCloseOnOpen = true }: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
  focusCloseOnOpen?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    const frame = focusCloseOnOpen
      ? window.requestAnimationFrame(() => closeRef.current?.focus())
      : null;
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [focusCloseOnOpen, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/65 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <section className={`relative max-h-[calc(100dvh-0.5rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[#344657] bg-[#121922] px-4 pt-3 shadow-[0_-16px_36px_rgba(0,0,0,0.42)] ${compact ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-[calc(1.25rem+env(safe-area-inset-bottom))]"}`}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#4A5968]" aria-hidden="true" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-extrabold leading-tight text-[#F3F7FA]">{title}</h2>
            {description ? <p className="mt-1 truncate text-sm text-[#A9B6C2]">{description}</p> : null}
          </div>
          <button ref={closeRef} type="button" aria-label="Cerrar" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#344657] text-lg font-bold text-[#A9B6C2] hover:bg-[#1D3140] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7FA3]">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function parseMobileNumber(value: string) {
  const clean = value.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") && clean.includes(".")
    ? clean.lastIndexOf(",") > clean.lastIndexOf(".") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "")
    : clean.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatInputMoney(value: number) {
  return value.toFixed(2);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
