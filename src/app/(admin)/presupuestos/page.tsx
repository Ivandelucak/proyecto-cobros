import { QuoteStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { quoteStatusLabels, quoteStatusTone } from "@/lib/quotes/quote-status";

export const dynamic = "force-dynamic";

type PresupuestosPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function PresupuestosPage({ searchParams }: PresupuestosPageProps) {
  await requireQuotePage();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = parseStatus(params.status);
  const numericQuery = Number(q.replace("#", ""));

  const quotes = await prisma.quote.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              ...(Number.isFinite(numericQuery) && numericQuery > 0
                ? [{ quoteNumber: numericQuery }]
                : []),
              { customerNameSnapshot: { contains: q } },
              { customerDocumentSnapshot: { contains: q } },
              { customerPhoneSnapshot: { contains: q } },
              { customerEmailSnapshot: { contains: q } }
            ]
          }
        : {})
    },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 80
  });

  return (
    <section className="space-y-5">
      <PageHeader
        title="Presupuestos"
        description="Cotizaciones para clientes. No descuentan stock, no crean ventas y no son factura."
        actions={
          <LinkButton href="/presupuestos/nuevo" variant="primary">
            Nuevo presupuesto
          </LinkButton>
        }
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cliente, documento o presupuesto #"
          />
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">Todos los estados</option>
            {Object.values(QuoteStatus).map((quoteStatus) => (
              <option key={quoteStatus} value={quoteStatus}>
                {quoteStatusLabels[quoteStatus]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
      </Card>

      {quotes.length === 0 ? (
        <EmptyState
          title="No hay presupuestos para mostrar"
          description="Crea un presupuesto nuevo o ajusta los filtros."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-4 py-3">Presupuesto</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Validez</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        #{quote.quoteNumber}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7F8D9A]">
                        {quote._count.items} items - {quote.createdBy.name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {quote.customerNameSnapshot}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7F8D9A]">
                        {quote.customerDocumentSnapshot ?? quote.customerPhoneSnapshot ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-[#A9B6C2]">
                      {formatDateTimeStable(quote.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-[#A9B6C2]">
                      {quote.validUntil ? formatDateInput(quote.validUntil) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={quoteStatusTone(quote.status)}>
                        {quoteStatusLabels[quote.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-950 dark:text-[#F3F7FA]">
                      {formatARS(quote.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <LinkButton href={`/presupuestos/${quote.id}`} size="sm">
                          Ver
                        </LinkButton>
                        <LinkButton
                          href={`/presupuestos/${quote.id}/editar`}
                          size="sm"
                          variant="outline"
                        >
                          Editar
                        </LinkButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}

async function requireQuotePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }
  return user;
}

function parseStatus(value: string | undefined) {
  return Object.values(QuoteStatus).includes(value as QuoteStatus)
    ? (value as QuoteStatus)
    : null;
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("/");
}
