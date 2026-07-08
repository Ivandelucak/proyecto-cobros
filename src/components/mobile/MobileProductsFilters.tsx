"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type CategoryOption = {
  id: string;
  name: string;
};

type MobileProductsFiltersProps = {
  categories: CategoryOption[];
  initialQ: string;
  initialCategoryId: string;
};

export function MobileProductsFilters({ categories, initialQ, initialCategoryId }: MobileProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  const applyFilters = (newQ: string, newCatId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newQ.trim()) {
      params.set("q", newQ.trim());
    } else {
      params.delete("q");
    }
    if (newCatId) {
      params.set("categoryId", newCatId);
    } else {
      params.delete("categoryId");
    }

    startTransition(() => {
      router.replace(`/m/productos?${params.toString()}`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters(q, categoryId);
      }}
      className="space-y-2.5 bg-[#121922] border border-[#273342] p-3.5 rounded-lg shadow"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, código..."
          className="flex-1 bg-[#0B1015] border border-[#273342] text-[#F3F7FA] placeholder-[#7F8D9A] text-xs rounded px-3 py-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#1D3140] hover:bg-[#3D6887] disabled:opacity-50 text-[#F3F7FA] font-bold text-xs px-3.5 py-2 rounded border border-[#273342]"
        >
          {isPending ? "..." : "Buscar"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#A9B6C2] uppercase font-bold tracking-wider">Categoría:</span>
        <select
          value={categoryId}
          onChange={(e) => {
            const val = e.target.value;
            setCategoryId(val);
            applyFilters(q, val);
          }}
          className="flex-1 bg-[#0B1015] border border-[#273342] text-[#F3F7FA] text-xs rounded px-2.5 py-1.5 focus:outline-none"
        >
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
