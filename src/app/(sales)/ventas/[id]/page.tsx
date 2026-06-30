import { FiscalStatus, PaymentMethod, Role, SaleStatus, UnitType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { formatDateTimeStable } from "@/lib/date-format";
import {
  fiscalDocumentStatusLabels,
  fiscalStatusLabels,
  fiscalStatusTone
} from "@/lib/fiscal/fiscal-status";
import { formatARS } from "@/lib/money";
import { providerStatusLabel } from "@/lib/payment-display";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import {
  buildReturnToHref,
  buildTicketHref,
  getSafeInternalReturnTo,
  isSafeInternalReturnTo
} from "@/lib/return-to";
import { getAccessibleSaleOrRedirect } from "@/lib/sale-access";
import { CancelSaleForm } from "./cancel-sale-form";

export const dynamic = "force-dynamic";

type VentaDetallePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function VentaDetallePage({
  params,
  searchParams
}: VentaDetallePageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const [{ sale, user }, paymentMethods, cashSetting] = await Promise.all([
    getAccessibleSaleOrRedirect(id),
    getPaymentMethodSettings(),
    getCashRegisterSetting()
  ]);
  const fallbackBackHref = user.role === Role.ADMIN ? "/ventas" : "/caja";
  const rawReturnTo = param(query.returnTo);
  const originalReturnTo = isSafeInternalReturnTo(rawReturnTo) ? rawReturnTo : null;
  const backHref = getSafeInternalReturnTo(originalReturnTo, fallbackBackHref);
  const ticketReturnTo = originalReturnTo ?? buildReturnToHref(`/ventas/${sale.id}`);
  const canCancelSale =
    sale.status === SaleStatus.PAID &&
    (user.role === Role.ADMIN || cashSetting.allowCashierCancelSale);
  const paymentLabels = Object.fromEntries(
    paymentMethods.map((method) => [method.method, method.label])
  ) as Record<PaymentMethod, string>;

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-6 text-[var(--text-primary)]">
      <section className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          title={`Venta #${sale.saleNumber}`}
          description={`Confirmada el ${formatDateTimeStable(sale.createdAt)} por ${sale.user.name}.`}
          actions={
            <>
              <LinkButton href={backHref}>Volver</LinkButton>
              <LinkButton href={buildTicketHref(sale.id, ticketReturnTo)} variant="primary">
                Ver ticket
              </LinkButton>
              {user.role === Role.ADMIN &&
              (sale.requiresFiscalInvoice || sale.fiscalDocument) ? (
                <LinkButton href={`/facturacion/${sale.id}`}>
                  Ver detalle fiscal
                </LinkButton>
              ) : null}
            </>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-[#273342]">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Productos
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium">Precio</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {item.productNameSnapshot}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {formatQuantity(item.quantity.toString(), item.unitTypeSnapshot)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {formatARS(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-[#7F8D9A]">
                    Estado
                  </p>
                  <div className="mt-2">
                    <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                      {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 dark:text-[#7F8D9A]">
                    Total
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-[#F3F7FA]">
                    {formatARS(sale.total)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm dark:border-[#273342]">
                <TotalRow label="Subtotal" value={formatARS(sale.subtotal)} />
                <TotalRow label="Descuento" value={formatARS(sale.discountTotal)} />
                <TotalRow label="Recargo" value={formatARS(sale.surchargeTotal)} />
                <TotalRow label="Total" value={formatARS(sale.total)} strong />
              </div>

              <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm dark:border-[#273342]">
                <TotalRow
                  label="Cliente"
                  value={sale.customer ? sale.customer.name : "Consumidor final"}
                />
                <TotalRow
                  label="Caja"
                  value={
                    sale.cashSession
                      ? `Abierta ${formatDateTimeStable(sale.cashSession.openedAt)}`
                      : "Sin caja asociada"
                  }
                />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Estado fiscal
              </h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600 dark:text-[#A9B6C2]">Estado</span>
                  <Badge tone={fiscalStatusTone(sale.fiscalStatus)}>
                    {fiscalStatusLabels[sale.fiscalStatus]}
                  </Badge>
                </div>
                <TotalRow
                  label="Requiere factura"
                  value={sale.requiresFiscalInvoice ? "Si" : "No"}
                />
                {sale.fiscalRequestedAt ? (
                  <TotalRow
                    label="Solicitada"
                    value={formatDateTimeStable(sale.fiscalRequestedAt)}
                  />
                ) : null}
                {sale.fiscalDocument ? (
                  <>
                    <TotalRow
                      label="Documento"
                      value={`${sale.fiscalDocument.letter} - ${
                        fiscalDocumentStatusLabels[sale.fiscalDocument.status]
                      }`}
                    />
                    <TotalRow
                      label="CAE"
                      value={sale.fiscalDocument.cae ?? "Pendiente de integracion ARCA"}
                    />
                  </>
                ) : null}
                {user.role === Role.ADMIN &&
                (sale.requiresFiscalInvoice || sale.fiscalDocument) ? (
                  <div className="pt-2">
                    <LinkButton href={`/facturacion/${sale.id}`} size="sm">
                      Ver detalle fiscal
                    </LinkButton>
                  </div>
                ) : null}
                {sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
                    La venta ya fue emitida fiscalmente. Requiere nota de credito.
                  </p>
                ) : null}
                {sale.fiscalFailureReason ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
                    {sale.fiscalFailureReason}
                  </p>
                ) : null}
              </div>
            </Card>

            {sale.status === SaleStatus.CANCELLED ? (
              <Card className="border-red-200 bg-red-50 p-5 dark:border-red-900/70 dark:bg-red-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
                      Venta anulada
                    </h2>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-200">
                      {sale.cancelledAt
                        ? formatDateTimeStable(sale.cancelledAt)
                        : "Sin fecha registrada"}
                    </p>
                  </div>
                  <Badge tone="red">Anulada</Badge>
                </div>
                <p className="mt-3 text-sm text-red-800 dark:text-red-100">
                  {sale.cancellationReason ?? "Sin motivo registrado"}
                </p>
              </Card>
            ) : null}

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Pagos
              </h2>
              <div className="mt-4 space-y-3">
                {sale.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#273342] dark:bg-[#121922]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                          {paymentLabels[payment.method]}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-[#7F8D9A]">
                          {paymentDescription(payment)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(payment.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {sale.accountMovements.length > 0 ? (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
                  Cuenta corriente generada: {formatARS(sale.accountMovements[0].amount)}
                </div>
              ) : null}
            </Card>

            {canCancelSale ? (
              <Card className="border-red-200 p-5 dark:border-red-900/60">
                <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                  Anular venta
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">
                  Se devolvera el stock y la venta quedara fuera de reportes y caja.
                </p>
                <div className="mt-4">
                  <CancelSaleForm saleId={sale.id} />
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function TotalRow({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between text-base font-semibold text-gray-950 dark:text-[#F3F7FA]"
          : "flex justify-between text-gray-600 dark:text-[#A9B6C2]"
      }
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function paymentDescription(payment: {
  method: PaymentMethod;
  receivedAmount: unknown;
  changeAmount: unknown;
  installments: number | null;
  surchargeRate: unknown;
  surchargeAmount: unknown;
  externalId: string | null;
  externalReference: string | null;
  providerStatus: string | null;
  paymentAttempt: {
    externalReference: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    status: string;
    origin: string;
    rawStatus: string | null;
    rawStatusDetail: string | null;
    mercadoPagoAccount: {
      name: string;
      environment: string;
    };
  } | null;
}) {
  const details: string[] = [];

  if (payment.method === PaymentMethod.CASH && payment.receivedAmount) {
    details.push(
      `Recibido ${formatARS(payment.receivedAmount as string)} - Vuelto ${formatARS(
        (payment.changeAmount as string) ?? 0
      )}`
    );
  }

  if (payment.method === PaymentMethod.CREDIT && payment.installments) {
    details.push(`${payment.installments} cuota${
      payment.installments > 1 ? "s" : ""
    } - Recargo ${formatARS((payment.surchargeAmount as string) ?? 0)}`);
  }

  if (payment.paymentAttempt) {
    details.push(
      `Mercado Pago ${payment.paymentAttempt.mercadoPagoAccount.name} (${payment.paymentAttempt.mercadoPagoAccount.environment})`
    );
    details.push(paymentAttemptOriginLabel(payment.paymentAttempt.origin));
    details.push(`Estado ${paymentAttemptStatusLabel(payment.paymentAttempt.status)}`);
    if (payment.paymentAttempt.providerOrderId) {
      details.push(`Orden ${payment.paymentAttempt.providerOrderId}`);
    }
    if (payment.paymentAttempt.providerPaymentId) {
      details.push(`Pago ${payment.paymentAttempt.providerPaymentId}`);
    }
  }

  if (payment.externalId) {
    details.push(`Operacion ${payment.externalId}`);
  }

  if (payment.externalReference && payment.externalReference !== payment.externalId) {
    details.push(`Referencia ${payment.externalReference}`);
  }

  const status = providerStatusLabel(payment.providerStatus);
  if (status) {
    details.push(`Estado ${status}`);
  }

  return details.length > 0 ? details.join(" - ") : "Pago aplicado";
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
