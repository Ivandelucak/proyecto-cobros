import { FiscalStatus, PaymentMethod, SaleStatus, UnitType } from "@prisma/client";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/ui/print-button";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";
import { formatDateTimeConfigured } from "@/lib/date-format";
import { fiscalStatusLabels } from "@/lib/fiscal/fiscal-status";
import { formatMoney } from "@/lib/money";
import { providerStatusLabel } from "@/lib/payment-display";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { getPrintSetting } from "@/lib/print-settings";
import { buildSaleDetailHref, getSafeInternalReturnTo, isSafeInternalReturnTo } from "@/lib/return-to";
import { getAccessibleSaleOrRedirect } from "@/lib/sale-access";
import { getTicketSetting } from "@/lib/ticket-settings";
import { cn } from "@/lib/ui";
import { TicketAutoPrint } from "./ticket-auto-print";

export const dynamic = "force-dynamic";

type TicketPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string | string[];
    print?: string | string[];
  }>;
};

export default async function TicketPage({ params, searchParams }: TicketPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const [{ sale }, business, printSetting, ticketSetting, paymentMethods] =
    await Promise.all([
      getAccessibleSaleOrRedirect(id),
      getBusinessProfileOrDefault(),
      getPrintSetting(),
      getTicketSetting(),
      getPaymentMethodSettings()
    ]);
  const rawReturnTo = param(query.returnTo);
  const returnTo = isSafeInternalReturnTo(rawReturnTo) ? rawReturnTo : null;
  const backHref = getSafeInternalReturnTo(returnTo, "/ventas");
  const shouldAutoPrint = param(query.print) === "1";
  const ticketWidth = getTicketWidth(printSetting.paperSize);
  const pageSize = getPageSize(printSetting.paperSize);
  const paymentLabels = Object.fromEntries(
    paymentMethods.map((method) => [method.method, method.label])
  ) as Record<PaymentMethod, string>;
  const money = (value: unknown) =>
    formatMoney(value as string, business.currency, business.locale);
  const dateTime = (value: Date) =>
    formatDateTimeConfigured(value, business.locale, business.timezone);
  const isTicket58 = printSetting.paperSize === "TICKET_58";
  const isA4 = printSetting.paperSize === "A4";
  const printSheetPosition = isA4
    ? "left: 50% !important; transform: translateX(-50%) !important;"
    : "left: 0 !important;";
  const sheetClassName = cn(
    "ticket-sheet mx-auto border border-gray-200 bg-white font-mono text-gray-950 shadow-sm dark:border-[#273342] dark:bg-white dark:text-gray-950",
    isA4
      ? "rounded-md p-8 text-[13px] leading-6"
      : isTicket58
        ? "p-2 text-[10.5px] leading-4"
        : "p-3 text-[11.5px] leading-5"
  );
  const titleClassName = cn(
    "font-bold uppercase tracking-wide",
    isA4 ? "text-xl" : isTicket58 ? "text-[13px]" : "text-[15px]"
  );

  const rawTitle = ticketSetting.ticketTitle;
  const rawLegend = ticketSetting.showNonFiscalLegend ? ticketSetting.nonFiscalLegend : null;

  const validTitle = isValidText(rawTitle) ? rawTitle : null;
  const validLegend = isValidText(rawLegend) ? rawLegend : null;

  let displayTitle: string | null = null;
  let displayLegend: string | null = null;

  if (validTitle) {
    displayTitle = validTitle;
    if (validLegend && !areTextsSimilar(validTitle, validLegend)) {
      displayLegend = validLegend;
    }
  } else if (validLegend) {
    displayTitle = validLegend;
  } else {
    displayTitle = "COMPROBANTE INTERNO - NO FISCAL";
  }

  return (
    <main className="ticket-print-page min-h-screen bg-[var(--app-bg)] px-4 py-6 text-[var(--text-primary)]">
      <style>{`
        .ticket-sheet {
          width: ${ticketWidth};
          max-width: ${ticketWidth};
        }
        .ticket-section,
        .ticket-item,
        .ticket-total,
        .ticket-footer {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @media print {
          @page { size: ${pageSize}; margin: ${printSetting.marginMm}mm; }
          html,
          body,
          .ticket-print-page {
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .ticket-print-controls { display: none !important; }
          .ticket-sheet,
          .ticket-sheet * {
            visibility: visible !important;
          }
          .ticket-sheet {
            position: absolute !important;
            ${printSheetPosition}
            top: 0 !important;
            width: ${ticketWidth} !important;
            max-width: ${ticketWidth} !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>
      <TicketAutoPrint enabled={shouldAutoPrint} />

      <div
        className="ticket-print-controls mx-auto mb-4 flex flex-wrap gap-2"
        style={{ maxWidth: ticketWidth }}
      >
        <LinkButton href={backHref}>Volver</LinkButton>
        <LinkButton href={buildSaleDetailHref(sale.id, returnTo)}>Detalle</LinkButton>
        <PrintButton saleId={sale.id} setting={printSetting} />
      </div>

      <article className={sheetClassName}>
        <header className="ticket-section text-center">
          {business.logoUrl && isValidText(business.logoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt={business.name}
              className={cn(
                "mx-auto mb-2 object-contain",
                isA4 ? "max-h-24 max-w-44" : "max-h-12 max-w-28"
              )}
            />
          ) : null}
          {ticketSetting.showBusinessName && isValidText(business.name) ? (
            <h1 className={titleClassName}>{business.name}</h1>
          ) : null}
          {ticketSetting.headerText && isValidText(ticketSetting.headerText) ? <p>{ticketSetting.headerText}</p> : null}
          {ticketSetting.showAddress && isValidText(business.address) ? <p>{business.address}</p> : null}
          {ticketSetting.showPhone && isValidText(business.phone) ? <p>Tel: {business.phone}</p> : null}
          {ticketSetting.showEmail && isValidText(business.email) ? <p>{business.email}</p> : null}
          {ticketSetting.showCuit && isValidText(business.cuit) ? <p>CUIT: {business.cuit}</p> : null}
          {isValidText(business.fiscalCondition) ? <p>Cond. Fiscal: {business.fiscalCondition}</p> : null}
          {isValidText(business.grossIncome) ? <p>IIBB: {business.grossIncome}</p> : null}
          {business.activityStartDate && isValidText(dateInputString(business.activityStartDate)) ? (
            <p>Inicio Act.: {new Intl.DateTimeFormat(business.locale || "es-AR", { timeZone: business.timezone || undefined, day: "2-digit", month: "2-digit", year: "numeric" }).format(business.activityStartDate)}</p>
          ) : null}
          {isValidText(business.website) ? <p>Web: {business.website}</p> : null}

          {displayLegend ? (
            <p className="mt-2 border-y border-dashed border-gray-500 py-1 font-semibold uppercase">
              {displayLegend}
            </p>
          ) : null}
          {displayTitle ? (
            <p className="mt-2 font-semibold uppercase">{displayTitle}</p>
          ) : null}

          {sale.fiscalStatus !== FiscalStatus.NOT_REQUESTED ? (
            <p className="mt-1 text-[11px] uppercase">
              {ticketFiscalStatusLabel(sale.fiscalStatus)}
            </p>
          ) : null}
          {sale.status === SaleStatus.CANCELLED ? (
            <p className="mt-2 border border-black py-1 text-sm font-bold uppercase">
              Venta anulada
            </p>
          ) : null}
        </header>

        <Divider />

        <section className="ticket-section space-y-1">
          <Line label="Venta" value={`#${sale.saleNumber}`} />
          <Line label="Fecha" value={dateTime(sale.createdAt)} />
          {ticketSetting.showSeller ? <Line label="Cajero" value={sale.user.name} /> : null}
          {ticketSetting.showCustomer && sale.customer ? (
            <Line label="Cliente" value={sale.customer.name} />
          ) : null}
          {sale.cashSession ? <Line label="Caja" value={sale.cashSession.id.slice(-6)} /> : null}
          {sale.requiresFiscalInvoice ? (
            <Line label="Fiscal" value={ticketFiscalStatusLabel(sale.fiscalStatus)} />
          ) : null}
        </section>

        <Divider />

        <section className="ticket-section space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-dashed border-gray-400 pb-1 text-[10px] font-semibold uppercase tracking-wide">
            <span>Producto</span>
            <span className="text-right">Subtotal</span>
          </div>
          {sale.items.map((item) => (
            <div key={item.id} className="ticket-item">
              <p className="break-words font-semibold uppercase">
                {item.productNameSnapshot}
              </p>
              {ticketSetting.showBarcode && (item.product.barcode || item.product.sku) ? (
                <p className="text-[11px]">Cod: {item.product.barcode ?? item.product.sku}</p>
              ) : null}
              <div className="mt-0.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <span className="text-gray-700">
                  {formatQuantity(
                    item.quantity.toString(),
                    item.unitTypeSnapshot,
                    ticketSetting.showStockUnit
                  )} x{" "}
                  {money(item.unitPrice)}
                </span>
                <span className="text-right font-medium">{money(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </section>

        <Divider />

        <section className="ticket-section space-y-1">
          <Line label="Subtotal" value={money(sale.subtotal)} />
          {hasAmount(sale.discountTotal) ? (
            <Line label="Descuento" value={money(sale.discountTotal)} />
          ) : null}
          {hasAmount(sale.surchargeTotal) ? (
            <Line label="Recargo" value={money(sale.surchargeTotal)} />
          ) : null}
          <div className="ticket-total mt-2 flex justify-between gap-3 border-y border-gray-900 py-1 text-base font-bold">
            <span>Total</span>
            <span>{money(sale.total)}</span>
          </div>
        </section>

        {ticketSetting.showPaymentDetails ? (
          <>
            <Divider />

            <section className="ticket-section space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide">
                Pagos
              </p>
              {sale.payments.map((payment) => (
                <div key={payment.id}>
                  <Line label={getPaymentMethodLabel(payment.method, paymentLabels[payment.method], payment.providerStatus)} value={money(payment.amount)} />
                  {payment.method === PaymentMethod.CASH && payment.receivedAmount ? (
                    <>
                      <Line label="Recibido" value={money(payment.receivedAmount)} />
                      <Line label="Vuelto" value={money(payment.changeAmount ?? 0)} />
                    </>
                  ) : null}
                  {payment.method === PaymentMethod.CREDIT && payment.installments ? (
                    <Line
                      label="Cuotas"
                      value={`${payment.installments} / recargo ${money(
                        payment.surchargeAmount ?? 0
                      )}`}
                    />
                  ) : null}
                  {payment.method === PaymentMethod.CURRENT_ACCOUNT ? (
                    <Line label="Cuenta corriente" value="Saldo cargado al cliente" />
                  ) : null}
                  {payment.paymentAttempt ? (
                    <>
                      <Line
                        label="MP cuenta"
                        value={payment.paymentAttempt.mercadoPagoAccount.name}
                      />
                      <Line
                        label="MP origen"
                        value={paymentAttemptOriginLabel(payment.paymentAttempt.origin)}
                      />
                      <Line
                        label="MP estado"
                        value={paymentAttemptStatusLabel(payment.paymentAttempt.status)}
                      />
                      {payment.paymentAttempt.providerOrderId && cleanReference(payment.paymentAttempt.providerOrderId) ? (
                        <Line
                          label="MP orden"
                          value={cleanReference(payment.paymentAttempt.providerOrderId) || ""}
                        />
                      ) : null}
                      {payment.paymentAttempt.providerPaymentId && cleanReference(payment.paymentAttempt.providerPaymentId) ? (
                        <Line
                          label="MP pago"
                          value={cleanReference(payment.paymentAttempt.providerPaymentId) || ""}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {payment.externalId && cleanReference(payment.externalId) ? (
                    <Line label="Operacion" value={cleanReference(payment.externalId) || ""} />
                  ) : null}
                  {payment.externalReference &&
                  payment.externalReference !== payment.externalId && cleanReference(payment.externalReference) ? (
                    <Line label="Referencia" value={cleanReference(payment.externalReference) || ""} />
                  ) : null}
                  {providerStatusLabel(payment.providerStatus) ? (
                    <Line
                      label="Estado"
                      value={providerStatusLabel(payment.providerStatus) ?? ""}
                    />
                  ) : null}
                </div>
              ))}
            </section>
          </>
        ) : null}

        <Divider />

        {sale.status === SaleStatus.CANCELLED ? (
          <>
            <section className="ticket-section">
              <Line
                label="Anulada"
                value={sale.cancelledAt ? dateTime(sale.cancelledAt) : "-"}
              />
              <p className="mt-1">Motivo: {sale.cancellationReason ?? "-"}</p>
            </section>
            <Divider />
          </>
        ) : null}

        <footer className="ticket-footer text-center">
          {ticketSetting.thankYouText && isValidText(ticketSetting.thankYouText) ? <p>{ticketSetting.thankYouText}</p> : null}
          {ticketSetting.footerText && isValidText(ticketSetting.footerText) ? <p>{ticketSetting.footerText}</p> : null}
          {business.generalFooterText && isValidText(business.generalFooterText) ? <p>{business.generalFooterText}</p> : null}
        </footer>
      </article>
    </main>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getTicketWidth(paperSize: string) {
  if (paperSize === "TICKET_58") {
    return "58mm";
  }
  if (paperSize === "A4") {
    return "180mm";
  }

  return "80mm";
}

function getPageSize(paperSize: string) {
  if (paperSize === "TICKET_58") {
    return "58mm auto";
  }
  if (paperSize === "A4") {
    return "A4";
  }

  return "80mm auto";
}

function ticketFiscalStatusLabel(status: FiscalStatus) {
  if (status === FiscalStatus.NOT_REQUESTED) {
    return "Ticket interno / no fiscal";
  }

  if (status === FiscalStatus.READY_TO_ISSUE) {
    return "Factura preparada, pendiente de emision real";
  }

  return fiscalStatusLabels[status];
}

function paymentAttemptStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
    EXPIRED: "Vencido",
    ERROR: "Error"
  };

  return labels[status] ?? status;
}

function paymentAttemptOriginLabel(origin: string) {
  const labels: Record<string, string> = {
    QR_ORDER: "QR API",
    AMOUNT_MATCH: "Match por monto",
    MANUAL_REFERENCE: "Referencia manual"
  };

  return labels[origin] ?? origin;
}

function Divider() {
  return <div className="my-3 border-t border-dashed border-gray-400" />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function hasAmount(value: unknown) {
  return Math.abs(Number(value)) > 0;
}

function formatQuantity(value: string, unitType: UnitType, showUnit: boolean) {
  const quantity = Number(value);
  const decimals = unitType === UnitType.UNIT && Number.isInteger(quantity) ? 0 : 3;

  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(quantity);

  return showUnit ? `${formatted} ${unitLabel(unitType)}` : formatted;
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

function isValidText(val: string | null | undefined): val is string {
  if (!val) return false;
  const n = val.trim().toLowerCase();
  if (n === "" || n.includes("???")) return false;
  const invalidKeywords = ["test", "lorem ipsum", "texto de prueba", "prueba", "condicion fiscal", "ingresos brutos"];
  return !invalidKeywords.some(keyword => n.includes(keyword));
}

function dateInputString(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function areTextsSimilar(t1: string | null | undefined, t2: string | null | undefined): boolean {
  if (!t1 || !t2) return false;
  const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean(t1) === clean(t2);
}

function cleanReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!isValidText(trimmed)) return null;
  if (trimmed.length > 12) {
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }
  return trimmed;
}

function getPaymentMethodLabel(method: PaymentMethod, fallbackLabel: string, providerStatus?: string | null) {
  if (method === PaymentMethod.CASH) return "Efectivo";
  if (method === PaymentMethod.MERCADOPAGO) return "Mercado Pago";
  if (method === PaymentMethod.TRANSFER) {
    const isVerified = providerStatus === "VERIFIED" || providerStatus === "verified" || providerStatus?.toLowerCase().includes("verific");
    return isVerified ? "Transferencia · verificada" : "Transferencia";
  }
  if (method === PaymentMethod.CREDIT) return "Crédito";
  if (method === PaymentMethod.DEBIT) return "Débito";
  if (method === PaymentMethod.CURRENT_ACCOUNT) return "Cuenta corriente";
  return fallbackLabel || method;
}

