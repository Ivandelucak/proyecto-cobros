import { QuoteStatus } from "@prisma/client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { formatDateTimeStable } from "@/lib/date-format";
import { quoteStatusLabels, quoteStatusTone } from "@/lib/quotes/quote-status";

import { MobilePageHeader } from "@/components/mobile/MobilePageHeader";

export const dynamic = "force-dynamic";

type PresupuestosMobilePageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function MobilePresupuestosPage({ searchParams }: PresupuestosMobilePageProps) {
  const user = await requireMobileAuth();
  const businessId = user.businessId!;

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const numericQuery = Number(q.replace("#", ""));

  const quotes = await prisma.quote.findMany({
    where: {
      businessId,
      ...(q
        ? {
            OR: [
              ...(Number.isFinite(numericQuery) && numericQuery > 0
                ? [{ quoteNumber: numericQuery }]
                : []),
              { customerNameSnapshot: { contains: q } },
              { customerDocumentSnapshot: { contains: q } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: 40
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <MobilePageHeader
        title="Presupuestos"
        subtitle="Cotizaciones guardadas para clientes."
        fallbackUrl="/m"
        rightAction={
          <Link
            href="/m/presupuestos/nuevo"
            className="bg-[#4C7FA3] hover:bg-[#3D6887] text-[#0B1015] font-bold text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-1 shadow"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </Link>
        }
      />

      {/* Search Input */}
      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente o nro..."
          className="flex-1 bg-[#121922] border border-[#273342] text-[#F3F7FA] placeholder-[#7F8D9A] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#4C7FA3]"
        />
        <button
          type="submit"
          className="bg-[#1D3140] hover:bg-[#3D6887] text-[#F3F7FA] font-bold text-xs px-4 py-2 rounded-lg border border-[#273342]"
        >
          Buscar
        </button>
      </form>

      {/* List */}
      <div className="space-y-3">
        {quotes.length === 0 ? (
          <Card className="p-8 text-center bg-[#121922] border-[#273342]">
            <p className="text-sm text-[#A9B6C2]">No se encontraron presupuestos.</p>
          </Card>
        ) : (
          quotes.map((quote) => (
            <Card key={quote.id} className="p-4 bg-[#121922] border-[#273342] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-[#F3F7FA]">Presupuesto #{quote.quoteNumber}</h4>
                  <p className="text-[11px] text-[#A9B6C2] mt-0.5">{formatDateTimeStable(quote.createdAt)}</p>
                </div>
                <div className="text-right">
                  <span className="block font-bold text-sm text-[#F3F7FA]">{formatARS(quote.total)}</span>
                  <Badge tone={quoteStatusTone(quote.status)}>
                    {quoteStatusLabels[quote.status]}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#273342] flex justify-between items-center text-xs text-[#7F8D9A]">
                <span>Cliente: {quote.customerNameSnapshot || "Consumidor Final"}</span>
                {quote.customerDocumentSnapshot && <span className="text-[11px]">{quote.customerDocumentSnapshot}</span>}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
