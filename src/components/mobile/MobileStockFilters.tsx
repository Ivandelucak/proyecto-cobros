"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type MobileStockFiltersProps = {
  initialQ: string;
  initialFilter: string;
};

export function MobileStockFilters({ initialQ, initialFilter }: MobileStockFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [filter, setFilter] = useState(initialFilter);

  const applyFilters = (newQ: string, newFilter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newQ.trim()) {
      params.set("q", newQ.trim());
    } else {
      params.delete("q");
    }
    if (newFilter && newFilter !== "all") {
      params.set("filter", newFilter);
    } else {
      params.delete("filter");
    }

    startTransition(() => {
      router.replace(`/m/stock?${params.toString()}`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters(q, filter);
      }}
      className="space-y-2 bg-[#121922] border border-[#273342] p-3.5 rounded-lg shadow"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto..."
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
        <span className="text-[10px] text-[#A9B6C2] uppercase font-bold tracking-wider">Filtro:</span>
        <select
          value={filter}
          onChange={(e) => {
            const val = e.target.value;
            setFilter(val);
            applyFilters(q, val);
          }}
          className="flex-1 bg-[#0B1015] border border-[#273342] text-[#F3F7FA] text-xs rounded px-2.5 py-1.5 focus:outline-none"
        >
          <option value="all">Todos</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
          <option value="ok">Stock OK</option>
        </select>
      </div>
    </form>
  );
}
