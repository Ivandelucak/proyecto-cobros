import { QuoteStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { quoteStatusLabels, quoteStatusTone } from "@/lib/quotes/quote-status";
import { changeQuoteStatusAction, duplicateQuoteAction } from "../actions";

export const dynamic = "force-dynamic";

type PresupuestoDetallePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PresupuestoDetallePage({ params }: PresupuestoDetallePageProps) {
  const user = await requireQuotePage();
  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: {
      id,
      businessId: user.businessId!
    },
    include: {
      createdBy: { select: { name: true } },
      items: { orderBy: { id: "asc" } }
    }
  });

  if (!quote) {
    redirect("/presupuestos");
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={`Presupuesto #${quote.quoteNumber}`}
        description={`Creado por ${quote.createdBy.name} el ${formatDateTimeStable(
          quote.createdAt
        )}.`}
        actions={
          <>
            <LinkButton href="/presupuestos" variant="outline">
              Volver
            </LinkButton>
            <LinkButton href={`/presupuestos/${quote.id}/editar`} variant="outline">
              Editar
            </LinkButton>
            <LinkButton href={`/presupuestos/${quote.id}/imprimir`} variant="primary">
              Imprimir
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                  Cliente
                </h2>
                <p className="mt-2 text-lg font-bold text-gray-950 dark:text-[#F3F7FA]">
                  {quote.customerNameSnapshot}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#7F8D9A]">
                  {[
                    quote.customerDocumentSnapshot,
                    quote.customerPhoneSnapshot,
                    quote.customerEmailSnapshot
                  ]
                    .filter(Boolean)
                    .join(" - ") || "Sin datos adicionales"}
                </p>
              </div>
              <Badge tone={quoteStatusTone(quote.status)}>
                {quoteStatusLabels[quote.status]}
              </Badge>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        {item.productNameSnapshot}
                        {item.notes ? (
                          <p className="mt-1 text-xs font-normal text-slate-500 dark:text-[#7F8D9A]">
                            {item.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-[#A9B6C2]">
                        {formatQuantity(item.quantity.toString())} {unitLabel(item.unitTypeSnapshot)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-[#A9B6C2]">
                        {formatARS(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {quote.notes || quote.terms ? (
            <Card className="grid gap-5 p-5 md:grid-cols-2">
              <TextBlock title="Notas" value={quote.notes} />
              <TextBlock title="Condiciones" value={quote.terms} />
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
              Estado
            </h2>
            <form action={changeQuoteStatusAction.bind(null, quote.id)} className="mt-4 space-y-3">
              <select
                name="status"
                defaultValue={quote.status}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-gray-950 dark:border-[#344457] dark:bg-[#121922] dark:text-[#F3F7FA]"
              >
                {Object.values(QuoteStatus).map((status) => (
                  <option key={status} value={status}>
                    {quoteStatusLabels[status]}
                  </option>
                ))}
              </select>
              <Button type="submit" className="w-full">
                Actualizar estado
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
              Totales
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <Line label="Subtotal" value={formatARS(quote.subtotal)} />
              <Line label="Descuento" value={formatARS(quote.discountTotal)} />
              <Line label="Recargo" value={formatARS(quote.surchargeTotal)} />
              <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-bold dark:border-[#273342]">
                <span>Total</span>
                <span>{formatARS(quote.total)}</span>
              </div>
            </div>
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
              Presupuesto no valido como factura.
            </p>
          </Card>

          <form action={duplicateQuoteAction.bind(null, quote.id)}>
            <Button type="submit" variant="secondary" className="w-full">
              Duplicar presupuesto
            </Button>
          </form>
        </aside>
      </div>
    </section>
  );
}

async function requireQuotePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }
  return user;
}

function TextBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-[#A9B6C2]">
        {value}
      </p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 dark:text-[#7F8D9A]">{label}</span>
      <span className="font-semibold text-gray-950 dark:text-[#F3F7FA]">{value}</span>
    </div>
  );
}

function formatQuantity(value: string) {
  const number = Number(value);
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 3,
    maximumFractionDigits: 3
  }).format(number);
}

function unitLabel(unitType: string) {
  const labels: Record<string, string> = {
    UNIT: "u.",
    KG: "kg",
    GR: "gr",
    LITER: "l",
    METER: "m",
    PACK: "pack",
    BOX: "caja",
    OTHER: "otro"
  };

  return labels[unitType] ?? unitType;
}
