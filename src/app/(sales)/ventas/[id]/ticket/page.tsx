import { PaymentMethod, Role, SaleStatus, UnitType } from "@prisma/client";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/ui/print-button";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getAccessibleSaleOrRedirect } from "@/lib/sale-access";

export const dynamic = "force-dynamic";

type TicketPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

export default async function TicketPage({ params }: TicketPageProps) {
  const { id } = await params;
  const [{ sale, user }, business] = await Promise.all([
    getAccessibleSaleOrRedirect(id),
    prisma.businessProfile.findFirst()
  ]);
  const backHref = user.role === Role.ADMIN ? "/ventas" : "/caja";

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6 text-gray-950 dark:bg-neutral-950 dark:text-gray-50">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { background: #fff !important; }
          .ticket-print-controls { display: none !important; }
          .ticket-sheet {
            width: 80mm !important;
            max-width: 80mm !important;
            border: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="ticket-print-controls mx-auto mb-4 flex max-w-[80mm] flex-wrap gap-2">
        <LinkButton href={backHref}>Volver</LinkButton>
        <LinkButton href={`/ventas/${sale.id}`}>Detalle</LinkButton>
        <PrintButton />
      </div>

      <article className="ticket-sheet mx-auto max-w-[80mm] rounded-md border border-gray-200 bg-white p-4 font-mono text-[12px] leading-5 text-gray-950 shadow-sm dark:border-neutral-800 dark:bg-white dark:text-gray-950">
        <header className="text-center">
          <h1 className="text-base font-bold uppercase">
            {business?.name ?? "POS Universal"}
          </h1>
          {business?.address ? <p>{business.address}</p> : null}
          {business?.phone ? <p>Tel: {business.phone}</p> : null}
          {business?.cuit ? <p>CUIT: {business.cuit}</p> : null}
          <p className="mt-2 font-semibold uppercase">Comprobante no fiscal</p>
          {sale.status === SaleStatus.CANCELLED ? (
            <p className="mt-2 border border-black py-1 text-sm font-bold uppercase">
              Venta anulada
            </p>
          ) : null}
        </header>

        <Divider />

        <section>
          <Line label="Venta" value={`#${sale.saleNumber}`} />
          <Line label="Fecha" value={formatDateTime(sale.createdAt)} />
          <Line label="Cajero" value={sale.user.name} />
          {sale.cashSession ? <Line label="Caja" value={sale.cashSession.id.slice(-6)} /> : null}
        </section>

        <Divider />

        <section className="space-y-2">
          {sale.items.map((item) => (
            <div key={item.id}>
              <p className="font-semibold uppercase">{item.productNameSnapshot}</p>
              <div className="flex justify-between gap-3">
                <span>
                  {formatQuantity(item.quantity.toString(), item.unitTypeSnapshot)} x{" "}
                  {formatARS(item.unitPrice)}
                </span>
                <span>{formatARS(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </section>

        <Divider />

        <section className="space-y-1">
          <Line label="Subtotal" value={formatARS(sale.subtotal)} />
          <Line label="Descuento" value={formatARS(sale.discountTotal)} />
          <Line label="Recargo" value={formatARS(sale.surchargeTotal)} />
          <div className="flex justify-between gap-3 text-base font-bold">
            <span>Total</span>
            <span>{formatARS(sale.total)}</span>
          </div>
        </section>

        <Divider />

        <section className="space-y-1">
          {sale.payments.map((payment) => (
            <div key={payment.id}>
              <Line label={paymentLabels[payment.method]} value={formatARS(payment.amount)} />
              {payment.method === PaymentMethod.CASH && payment.receivedAmount ? (
                <>
                  <Line label="Recibido" value={formatARS(payment.receivedAmount)} />
                  <Line label="Vuelto" value={formatARS(payment.changeAmount ?? 0)} />
                </>
              ) : null}
              {payment.method === PaymentMethod.CREDIT && payment.installments ? (
                <Line
                  label="Cuotas"
                  value={`${payment.installments} / recargo ${formatARS(
                    payment.surchargeAmount ?? 0
                  )}`}
                />
              ) : null}
            </div>
          ))}
        </section>

        <Divider />

        {sale.status === SaleStatus.CANCELLED ? (
          <>
            <section>
              <Line
                label="Anulada"
                value={sale.cancelledAt ? formatDateTime(sale.cancelledAt) : "-"}
              />
              <p className="mt-1">Motivo: {sale.cancellationReason ?? "-"}</p>
            </section>
            <Divider />
          </>
        ) : null}

        <footer className="text-center">
          <p>Gracias por su compra</p>
          <p>Conserve este comprobante</p>
        </footer>
      </article>
    </main>
  );
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

function formatQuantity(value: string, unitType: UnitType) {
  const quantity = Number(value);
  const decimals = unitType === UnitType.UNIT && Number.isInteger(quantity) ? 0 : 3;

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(quantity)} ${unitLabel(unitType)}`;
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

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(value);
}
