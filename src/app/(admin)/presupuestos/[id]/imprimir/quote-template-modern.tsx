import type { BusinessProfileView } from "@/lib/business-profile";
import { formatDateTimeConfigured } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { quoteStatusLabels } from "@/lib/quotes/quote-status";
import type { Prisma, QuoteStatus, UnitType } from "@prisma/client";

type QuotePrintTemplateProps = {
  business: BusinessProfileView;
  quote: {
    quoteNumber: number;
    status: QuoteStatus;
    customerNameSnapshot: string;
    customerDocumentSnapshot: string | null;
    customerPhoneSnapshot: string | null;
    customerEmailSnapshot: string | null;
    customer: { address: string | null } | null;
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    surchargeTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    validUntil: Date | null;
    notes: string | null;
    terms: string | null;
    createdAt: Date;
    createdBy: { name: string };
    items: Array<{
      id: string;
      productNameSnapshot: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      unitTypeSnapshot: UnitType;
      notes: string | null;
    }>;
  };
};

export function QuotePrintTemplate({ business, quote }: QuotePrintTemplateProps) {
  const money = (value: Prisma.Decimal | number | string) =>
    formatMoney(value, business.currency, business.locale);
  const issueDate = formatDateTimeConfigured(
    quote.createdAt,
    business.locale,
    business.timezone
  );
  const validUntil = quote.validUntil
    ? formatDate(quote.validUntil, business.locale, business.timezone)
    : null;
  const quoteNumber = formatQuoteNumber(quote.quoteNumber);
  const businessLines = [
    business.cuit ? `CUIT ${business.cuit}` : null,
    business.address,
    business.phone ? `Tel. ${business.phone}` : null,
    business.email,
    business.fiscalCondition
  ].filter(Boolean);
  const customerLines = [
    quote.customerDocumentSnapshot ? `Documento: ${quote.customerDocumentSnapshot}` : null,
    quote.customerPhoneSnapshot ? `Telefono: ${quote.customerPhoneSnapshot}` : null,
    quote.customerEmailSnapshot ? `Email: ${quote.customerEmailSnapshot}` : null,
    quote.customer?.address ? `Direccion: ${quote.customer.address}` : null
  ].filter(Boolean);
  const hasDiscount = quote.discountTotal.gt(0);
  const hasSurcharge = quote.surchargeTotal.gt(0);

  return (
    <article className="quote-print-sheet relative mx-auto min-w-[760px] max-w-[210mm] overflow-hidden rounded-xl border border-slate-200 bg-white p-8 text-slate-950 shadow-xl shadow-slate-950/10 dark:border-[#273342] dark:bg-white dark:text-slate-950 print:min-w-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="pointer-events-none absolute right-8 top-44 select-none text-7xl font-black uppercase tracking-normal text-slate-100/70 print:text-slate-100/55">
        Presupuesto
      </div>

      <header className="relative grid gap-8 border-b border-slate-200 pb-7 md:grid-cols-[minmax(0,1fr)_270px] print:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logoUrl}
                alt={business.name}
                className="h-20 w-20 shrink-0 object-contain"
              />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-xl font-black text-brand-700">
                {initials(business.name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-black uppercase tracking-normal text-slate-950">
                {business.name}
              </h1>
              {businessLines.length > 0 ? (
                <div className="mt-2 space-y-0.5 text-sm leading-5 text-slate-600">
                  {businessLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-right print:bg-white">
          <p className="text-xs font-bold uppercase tracking-normal text-brand-700">
            Presupuesto
          </p>
          <p className="mt-2 text-4xl font-black tracking-normal text-slate-950">
            #{quoteNumber}
          </p>
          <div className="mt-3 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold uppercase text-slate-700">
            {quoteStatusLabels[quote.status]}
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <InfoRow label="Emision" value={issueDate} />
            {validUntil ? <InfoRow label="Valido hasta" value={validUntil} /> : null}
            <InfoRow label="Vendedor" value={quote.createdBy.name} />
          </dl>
        </div>
      </header>

      <section className="relative grid gap-5 py-7 md:grid-cols-[minmax(0,1fr)_250px] print:grid-cols-[minmax(0,1fr)_230px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-normal text-slate-500">
            Cliente
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            {quote.customerNameSnapshot || "Cliente no especificado"}
          </h2>
          {customerLines.length > 0 ? (
            <div className="mt-3 grid gap-1 text-sm leading-5 text-slate-600">
              {customerLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sin datos adicionales.</p>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-sm leading-6 text-amber-950 print:bg-white">
          <p className="font-bold uppercase">Aclaracion</p>
          <p className="mt-2">Este presupuesto no es valido como factura.</p>
          <p className="mt-1">
            Los precios pueden variar segun disponibilidad y fecha de aceptacion.
          </p>
        </div>
      </section>

      <section className="relative">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600 print:bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-black">Producto</th>
                <th className="w-32 px-4 py-3 text-right font-black">Cantidad</th>
                <th className="w-40 px-4 py-3 text-right font-black">Precio unitario</th>
                <th className="w-40 px-4 py-3 text-right font-black">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quote.items.map((item) => (
                <tr key={item.id} className="quote-print-row">
                  <td className="px-4 py-4 align-top">
                    <p className="font-bold text-slate-950">{item.productNameSnapshot}</p>
                    {item.notes ? (
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.notes}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-right align-top text-slate-700">
                    {formatQuantity(item.quantity)} {unitLabel(item.unitTypeSnapshot)}
                  </td>
                  <td className="px-4 py-4 text-right align-top text-slate-700">
                    {money(item.unitPrice)}
                  </td>
                  <td className="px-4 py-4 text-right align-top font-bold text-slate-950">
                    {money(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="relative mt-7 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] print:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {quote.notes ? <TextBox title="Notas" value={quote.notes} /> : null}
          {quote.terms ? <TextBox title="Condiciones" value={quote.terms} /> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
          <SummaryLine label="Subtotal" value={money(quote.subtotal)} />
          {hasDiscount ? <SummaryLine label="Descuento" value={money(quote.discountTotal)} /> : null}
          {hasSurcharge ? <SummaryLine label="Recargo" value={money(quote.surchargeTotal)} /> : null}
          <div className="mt-4 rounded-lg bg-slate-950 px-4 py-3 text-white print:border print:border-slate-950 print:bg-white print:text-slate-950">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold uppercase tracking-normal">Total</span>
              <span className="text-2xl font-black">{money(quote.total)}</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="quote-print-footer relative mt-10 grid gap-6 border-t border-slate-200 pt-6 text-sm text-slate-600 md:grid-cols-[minmax(0,1fr)_240px] print:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <p className="font-bold text-slate-950">{business.name}</p>
          <p className="mt-1">Presupuesto no valido como factura</p>
        </div>
        <div className="border-t border-slate-400 pt-2 text-center text-xs uppercase text-slate-500">
          Firma / aceptacion
        </div>
      </footer>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}

function TextBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function formatQuoteNumber(value: number) {
  return String(value).padStart(6, "0");
}

function formatDate(date: Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale || "es-AR", {
    timeZone: timeZone || "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatQuantity(value: Prisma.Decimal) {
  const number = value.toNumber();
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 3,
    maximumFractionDigits: 3
  }).format(number);
}

function unitLabel(unitType: UnitType) {
  const labels: Record<UnitType, string> = {
    UNIT: "u.",
    KG: "kg",
    GR: "gr",
    LITER: "l",
    METER: "m",
    PACK: "pack",
    BOX: "caja",
    OTHER: "otro"
  };

  return labels[unitType];
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
