import { FiscalStatus, PaymentMethod, Role, SaleStatus, UnitType } from "@prisma/client";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/ui/print-button";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";
import { formatDateTimeConfigured } from "@/lib/date-format";
import { fiscalStatusLabels } from "@/lib/fiscal/fiscal-status";
import { formatMoney } from "@/lib/money";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { getPrintSetting } from "@/lib/print-settings";
import { getAccessibleSaleOrRedirect } from "@/lib/sale-access";
import { getTicketSetting } from "@/lib/ticket-settings";

export const dynamic = "force-dynamic";

type TicketPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TicketPage({ params }: TicketPageProps) {
  const { id } = await params;
  const [{ sale, user }, business, printSetting, ticketSetting, paymentMethods] =
    await Promise.all([
      getAccessibleSaleOrRedirect(id),
      getBusinessProfileOrDefault(),
      getPrintSetting(),
      getTicketSetting(),
      getPaymentMethodSettings()
    ]);
  const backHref = user.role === Role.ADMIN ? "/ventas" : "/caja";
  const ticketWidth = getTicketWidth(printSetting.paperSize);
  const pageSize = getPageSize(printSetting.paperSize);
  const paymentLabels = Object.fromEntries(
    paymentMethods.map((method) => [method.method, method.label])
  ) as Record<PaymentMethod, string>;
  const money = (value: unknown) =>
    formatMoney(value as string, business.currency, business.locale);
  const dateTime = (value: Date) =>
    formatDateTimeConfigured(value, business.locale, business.timezone);

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6 text-gray-950 dark:bg-neutral-950 dark:text-gray-50">
      <style>{`
        .ticket-sheet {
          width: ${ticketWidth};
          max-width: ${ticketWidth};
        }
        @media print {
          @page { size: ${pageSize}; margin: ${printSetting.marginMm}mm; }
          body { background: #fff !important; }
          .ticket-print-controls { display: none !important; }
          .ticket-sheet {
            width: ${ticketWidth} !important;
            max-width: ${ticketWidth} !important;
            border: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div
        className="ticket-print-controls mx-auto mb-4 flex flex-wrap gap-2"
        style={{ maxWidth: ticketWidth }}
      >
        <LinkButton href={backHref}>Volver</LinkButton>
        <LinkButton href={`/ventas/${sale.id}`}>Detalle</LinkButton>
        <PrintButton saleId={sale.id} setting={printSetting} />
      </div>

      <article className="ticket-sheet mx-auto rounded-md border border-gray-200 bg-white p-4 font-mono text-[12px] leading-5 text-gray-950 shadow-sm dark:border-neutral-800 dark:bg-white dark:text-gray-950">
        <header className="text-center">
          {ticketSetting.showBusinessName ? (
            <h1 className="text-base font-bold uppercase">{business.name}</h1>
          ) : null}
          {ticketSetting.headerText ? <p>{ticketSetting.headerText}</p> : null}
          {ticketSetting.showAddress && business.address ? <p>{business.address}</p> : null}
          {ticketSetting.showPhone && business.phone ? <p>Tel: {business.phone}</p> : null}
          {ticketSetting.showEmail && business.email ? <p>{business.email}</p> : null}
          {ticketSetting.showCuit && business.cuit ? <p>CUIT: {business.cuit}</p> : null}
          {business.fiscalCondition ? <p>{business.fiscalCondition}</p> : null}
          {ticketSetting.showNonFiscalLegend ? (
            <p className="mt-2 font-semibold uppercase">{ticketSetting.nonFiscalLegend}</p>
          ) : null}
          <p className="mt-1 font-semibold uppercase">{ticketSetting.ticketTitle}</p>
          <p className="mt-1 text-[11px] uppercase">
            {sale.fiscalStatus === FiscalStatus.NOT_REQUESTED
              ? "Ticket interno / no fiscal"
              : fiscalStatusLabels[sale.fiscalStatus]}
          </p>
          {sale.status === SaleStatus.CANCELLED ? (
            <p className="mt-2 border border-black py-1 text-sm font-bold uppercase">
              Venta anulada
            </p>
          ) : null}
        </header>

        <Divider />

        <section>
          <Line label="Venta" value={`#${sale.saleNumber}`} />
          <Line label="Fecha" value={dateTime(sale.createdAt)} />
          {ticketSetting.showSeller ? <Line label="Cajero" value={sale.user.name} /> : null}
          {ticketSetting.showCustomer && sale.customer ? (
            <Line label="Cliente" value={sale.customer.name} />
          ) : null}
          {sale.cashSession ? <Line label="Caja" value={sale.cashSession.id.slice(-6)} /> : null}
          {sale.requiresFiscalInvoice ? (
            <Line label="Fiscal" value={fiscalStatusLabels[sale.fiscalStatus]} />
          ) : null}
        </section>

        <Divider />

        <section className="space-y-2">
          {sale.items.map((item) => (
            <div key={item.id}>
              <p className="font-semibold uppercase">{item.productNameSnapshot}</p>
              {ticketSetting.showBarcode && (item.product.barcode || item.product.sku) ? (
                <p className="text-[11px]">Cod: {item.product.barcode ?? item.product.sku}</p>
              ) : null}
              <div className="flex justify-between gap-3">
                <span>
                  {formatQuantity(
                    item.quantity.toString(),
                    item.unitTypeSnapshot,
                    ticketSetting.showStockUnit
                  )} x{" "}
                  {money(item.unitPrice)}
                </span>
                <span>{money(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </section>

        <Divider />

        <section className="space-y-1">
          <Line label="Subtotal" value={money(sale.subtotal)} />
          <Line label="Descuento" value={money(sale.discountTotal)} />
          <Line label="Recargo" value={money(sale.surchargeTotal)} />
          <div className="flex justify-between gap-3 text-base font-bold">
            <span>Total</span>
            <span>{money(sale.total)}</span>
          </div>
        </section>

        {ticketSetting.showPaymentDetails ? (
          <>
            <Divider />

            <section className="space-y-1">
              {sale.payments.map((payment) => (
                <div key={payment.id}>
                  <Line label={paymentLabels[payment.method]} value={money(payment.amount)} />
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
                </div>
              ))}
            </section>
          </>
        ) : null}

        <Divider />

        {sale.status === SaleStatus.CANCELLED ? (
          <>
            <section>
              <Line
                label="Anulada"
                value={sale.cancelledAt ? dateTime(sale.cancelledAt) : "-"}
              />
              <p className="mt-1">Motivo: {sale.cancellationReason ?? "-"}</p>
            </section>
            <Divider />
          </>
        ) : null}

        <footer className="text-center">
          <p>{ticketSetting.thankYouText}</p>
          {ticketSetting.footerText ? <p>{ticketSetting.footerText}</p> : null}
          {business.generalFooterText ? <p>{business.generalFooterText}</p> : null}
        </footer>
      </article>
    </main>
  );
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

function Divider() {
  return <div className="my-3 border-t border-dashed border-gray-400" />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
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
