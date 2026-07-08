"use client";

import { useActionState, useState } from "react";
import { createMobileQuoteAction, MobileQuoteFormState } from "./actions";

type ProductOption = {
  id: string;
  name: string;
  salePrice: number;
  unitType: string;
};

type Item = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitType: string;
};

export function QuoteBuilder({ products }: { products: ProductOption[] }) {
  const [state, formAction, pending] = useActionState(createMobileQuoteAction, {});
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState("1");

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 5);
    setSearchResults(filtered);
  };

  const addProduct = (p: ProductOption) => {
    const existing = items.find((item) => item.productId === p.id);
    if (existing) {
      setItems(
        items.map((item) =>
          item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setItems([
        ...items,
        {
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: p.salePrice,
          unitType: p.unitType
        }
      ]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const addManualItem = () => {
    if (!manualName.trim() || !manualPrice) return;
    setItems([
      ...items,
      {
        productId: null,
        productName: manualName.trim(),
        quantity: parseFloat(manualQty) || 1,
        unitPrice: parseFloat(manualPrice) || 0,
        unitType: "UNIT"
      }
    ]);
    setManualName("");
    setManualPrice("");
    setManualQty("1");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, qty: number) => {
    if (qty <= 0) return;
    setItems(items.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="p-3 bg-[#E16060]/10 border border-[#E16060]/30 rounded-lg text-xs text-[#E16060]">
          {state.error}
        </div>
      )}

      {/* Client Info Card */}
      <div className="bg-[#121922] border border-[#273342] rounded-lg p-4 space-y-3 shadow">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Datos del Cliente</h3>
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-[#A9B6C2]">Nombre del Cliente</span>
            <input
              type="text"
              name="customerName"
              required
              placeholder="Ej: Juan Perez"
              className="mt-1 w-full bg-[#0B1015] border border-[#273342] text-sm rounded px-3 py-2 text-[#F3F7FA] focus:outline-none focus:border-[#4C7FA3]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#A9B6C2]">Documento (Opcional)</span>
            <input
              type="text"
              name="customerDocument"
              placeholder="Ej: DNI o CUIT"
              className="mt-1 w-full bg-[#0B1015] border border-[#273342] text-sm rounded px-3 py-2 text-[#F3F7FA] focus:outline-none focus:border-[#4C7FA3]"
            />
          </label>
        </div>
      </div>

      {/* Product Search */}
      <div className="bg-[#121922] border border-[#273342] rounded-lg p-4 space-y-3 shadow">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Buscar Producto</h3>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Escribir nombre del producto..."
            className="w-full bg-[#0B1015] border border-[#273342] text-sm rounded px-3 py-2 text-[#F3F7FA] focus:outline-none focus:border-[#4C7FA3]"
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-[#121922] border border-[#273342] rounded-lg shadow-lg divide-y divide-[#273342] overflow-hidden">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#1D3140]/30 text-xs text-[#F3F7FA] flex justify-between items-center"
                >
                  <span>{p.name}</span>
                  <span className="font-bold text-[#4C7FA3]">${p.salePrice}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Item */}
      <div className="bg-[#121922] border border-[#273342] rounded-lg p-4 space-y-3 shadow">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Agregar Item Manual</h3>
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-6">
            <span className="text-[10px] text-[#A9B6C2]">Descripción</span>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Servicio / Item"
              className="mt-0.5 w-full bg-[#0B1015] border border-[#273342] text-xs rounded px-2.5 py-1.5 text-[#F3F7FA] focus:outline-none"
            />
          </div>
          <div className="col-span-3">
            <span className="text-[10px] text-[#A9B6C2]">Precio</span>
            <input
              type="number"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="0.00"
              className="mt-0.5 w-full bg-[#0B1015] border border-[#273342] text-xs rounded px-2.5 py-1.5 text-[#F3F7FA] focus:outline-none"
            />
          </div>
          <div className="col-span-3">
            <button
              type="button"
              onClick={addManualItem}
              className="w-full bg-[#1D3140] hover:bg-[#4C7FA3] text-[#F3F7FA] hover:text-[#0B1015] font-bold text-xs py-1.5 rounded border border-[#273342] transition-colors"
            >
              Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-[#121922] border border-[#273342] rounded-lg p-4 space-y-3 shadow">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A]">Detalle de Items</h3>
        <div className="divide-y divide-[#273342]">
          {items.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#7F8D9A]">No hay productos agregados.</p>
          ) : (
            items.map((item, index) => (
              <div key={index} className="py-2.5 first:pt-0 last:pb-0 flex justify-between gap-3 items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-[#F3F7FA] truncate">{item.productName}</p>
                  <p className="text-[11px] text-[#A9B6C2] mt-0.5">${item.unitPrice}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateQty(index, parseFloat(e.target.value) || 1)}
                    className="w-12 bg-[#0B1015] border border-[#273342] text-center text-xs rounded py-1 text-[#F3F7FA]"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-[#E16060] p-1 hover:bg-[#E16060]/10 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-[#273342] flex justify-between items-center">
          <span className="text-xs text-[#A9B6C2]">Total Estimado</span>
          <span className="text-base font-black text-[#4C7FA3]">${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-[#121922] border border-[#273342] rounded-lg p-4 space-y-2 shadow">
        <span className="text-xs text-[#A9B6C2]">Notas internas (Opcional)</span>
        <textarea
          name="notes"
          rows={2}
          placeholder="Notas adicionales..."
          className="w-full bg-[#0B1015] border border-[#273342] text-sm rounded px-3 py-2 text-[#F3F7FA] focus:outline-none focus:border-[#4C7FA3]"
        />
      </div>

      {/* Hidden serialization */}
      <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

      {/* Actions */}
      <button
        type="submit"
        disabled={pending || items.length === 0}
        className="w-full bg-[#28A36A] hover:bg-[#208354] disabled:bg-[#273342] disabled:text-[#7F8D9A] text-[#0B1015] font-black py-3 rounded-lg text-sm shadow transition-colors"
      >
        {pending ? "Guardando..." : "Guardar Presupuesto"}
      </button>
    </form>
  );
}
