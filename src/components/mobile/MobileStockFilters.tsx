"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function MobileStockFilters({ initialQ, initialFilter }: { initialQ: string; initialFilter: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [filter, setFilter] = useState(initialFilter);

  const applyFilters = (nextQuery: string, nextFilter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    nextQuery.trim() ? params.set("q", nextQuery.trim()) : params.delete("q");
    nextFilter && nextFilter !== "all" ? params.set("filter", nextFilter) : params.delete("filter");
    startTransition(() => router.replace(`/m/stock?${params.toString()}`));
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); applyFilters(q, filter); }} className="space-y-3 rounded-xl border border-[#273342] bg-[#121922] p-4 shadow-sm">
      <div className="flex gap-2">
        <input type="text" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar producto..." className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#273342] bg-[#0B1015] px-3 text-sm text-[#F3F7FA] placeholder-[#7F8D9A] focus:border-[#4C7FA3] focus:outline-none" />
        <button type="submit" disabled={isPending} className="min-h-11 rounded-lg border border-[#344657] bg-[#1D3140] px-4 text-sm font-bold text-[#F3F7FA] hover:bg-[#3D6887] disabled:opacity-50">{isPending ? "..." : "Buscar"}</button>
      </div>
      <label className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#A9B6C2]">Filtro</span>
        <select value={filter} onChange={(event) => { const value = event.target.value; setFilter(value); applyFilters(q, value); }} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#273342] bg-[#0B1015] px-3 text-sm text-[#F3F7FA] focus:border-[#4C7FA3] focus:outline-none">
          <option value="all">Todos</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
          <option value="ok">Stock OK</option>
        </select>
      </label>
    </form>
  );
}
