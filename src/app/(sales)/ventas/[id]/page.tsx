import { FiscalStatus, PaymentMethod, Role, SaleStatus, UnitType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/ui/print-button";
import { getPrintSetting } from "@/lib/print-settings";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { formatDateTimeStable } from "@/lib/date-format";
import {
  fiscalDocumentStatusLabels,
  fiscalStatusLabels,
  fiscalStatusTone
} from "@/lib/fiscal/fiscal-status";
import { fiscalDocumentTypeLabels } from "@/lib/fiscal/fiscal-documents";
import { FiscalSaleActions } from "@/app/(admin)/facturacion/fiscal-sale-actions";
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
import { cn } from "@/lib/ui";
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
  const { sale, user } = await getAccessibleSaleOrRedirect(id);
  const [paymentMethods, cashSetting, printSetting] = await Promise.all([
    getPaymentMethodSettings(user.businessId!),
    getCashRegisterSetting(user.businessId!),
    getPrintSetting(user.businessId!)
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

  const isAdminOrOwner = user.role === Role.ADMIN || user.role === Role.OWNER;
  const canPrepare = isPreparableFiscalStatus(sale.fiscalStatus);
  const canMarkNotRequested =
    sale.fiscalStatus === FiscalStatus.PENDING ||
    sale.fiscalStatus === FiscalStatus.FAILED;
  const canCancelBeforeIssue =
    sale.status === SaleStatus.PAID && isPreparableFiscalStatus(sale.fiscalStatus);

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-4 text-[var(--text-primary)] md:p-6">
      <section className="mx-auto max-w-6xl space-y-4">
        {/* Custom compact header */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-[#273342] dark:bg-[#121922] md:flex-row md:items-center md:justify-between md:py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">
                Fox Point
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                Confirmada por {sale.user.name}
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                {formatDateTimeStable(sale.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-gray-950 dark:text-[#F3F7FA]">
                Venta #{sale.saleNumber}
              </h1>
              <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <LinkButton href={backHref} size="sm">
              Volver
            </LinkButton>
            <LinkButton href={buildTicketHref(sale.id, ticketReturnTo)} size="sm">
              Ver ticket
            </LinkButton>
            <PrintButton
              saleId={sale.id}
              setting={printSetting}
              printHref={buildTicketHref(sale.id, ticketReturnTo)}
              size="sm"
            />
            {user.role === Role.ADMIN && (sale.requiresFiscalInvoice || sale.fiscalDocument) ? (
              <LinkButton href={`/facturacion/${sale.id}`} size="sm">
                Detalle fiscal
              </LinkButton>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {/* Card de Productos */}
            <Card className="overflow-hidden shadow-sm">
              <div className="border-b border-gray-100 px-4 py-2.5 dark:border-[#273342]">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#7F8D9A]">
                  Detalle de Productos
                </h2>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 uppercase tracking-wider text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Producto</th>
                      <th className="px-4 py-2 text-right font-semibold">Cantidad</th>
                      <th className="px-4 py-2 text-right font-semibold">Precio</th>
                      <th className="px-4 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#273342]/60">
                    {sale.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-[#121922]/30">
                        <td className="px-4 py-2 font-medium text-gray-950 dark:text-[#F3F7FA]">
                          <div>{item.productNameSnapshot}</div>
                          {item.isManual ? (
                            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                              Artículo manual
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700 dark:text-[#A9B6C2]">
                          {formatQuantity(item.quantity.toString(), item.unitTypeSnapshot)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700 dark:text-[#A9B6C2]">
                          {formatARS(item.unitPrice)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-950 dark:text-[#F3F7FA]">
                          {formatARS(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {sale.status === SaleStatus.CANCELLED ? (
              <Card className="border-red-200 bg-red-50/30 p-4 dark:border-red-900/40 dark:bg-red-950/10 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                      Venta Anulada
                    </h2>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {sale.cancelledAt
                        ? formatDateTimeStable(sale.cancelledAt)
                        : "Sin fecha registrada"}
                    </p>
                  </div>
                  <Badge tone="red">Anulada</Badge>
                </div>
                <p className="mt-3 text-xs text-red-800 dark:text-red-200">
                  Motivo: {sale.cancellationReason ?? "Sin motivo registrado"}
                </p>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            {/* Card Resumen principal */}
            <Card className="p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-[#273342]">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#7F8D9A]">
                  Resumen de Venta
                </h2>
                <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                  {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                </Badge>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <TotalRow label="Cliente" value={sale.customer ? sale.customer.name : "Consumidor final"} />
                <TotalRow
                  label="Caja"
                  value={
                    sale.cashSession
                      ? `Nro: ${sale.cashSession.id.slice(-6)}`
                      : "Sin caja"
                  }
                />
              </div>

              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-xs dark:border-[#273342]">
                <TotalRow label="Subtotal" value={formatARS(sale.subtotal)} />
                {Number(sale.discountTotal) > 0 ? (
                  <TotalRow label="Descuento" value={`-${formatARS(sale.discountTotal)}`} className="text-[var(--success)]" />
                ) : null}
                {Number(sale.surchargeTotal) > 0 ? (
                  <TotalRow label="Recargo" value={formatARS(sale.surchargeTotal)} />
                ) : null}
                <div className="flex justify-between pt-1.5 text-sm font-bold text-gray-950 dark:text-[#F3F7FA]">
                  <span>Total</span>
                  <span>{formatARS(sale.total)}</span>
                </div>
              </div>
            </Card>

            {/* Card Estado Fiscal */}
            <Card className="p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#7F8D9A] border-b border-gray-100 pb-2.5 dark:border-[#273342]">
                Facturación
              </h2>
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-[#7F8D9A]">Comprobante</span>
                  <span className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                    {sale.fiscalDocument
                      ? `${fiscalDocumentTypeLabels[sale.fiscalDocument.type]} ${sale.fiscalDocument.letter}`
                      : "Ticket interno"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-[#7F8D9A]">Estado fiscal</span>
                  <Badge tone={fiscalStatusTone(sale.fiscalStatus)}>
                    {sale.fiscalStatus === FiscalStatus.NOT_REQUESTED
                      ? "No requerida"
                      : fiscalStatusLabels[sale.fiscalStatus]}
                  </Badge>
                </div>

                {sale.fiscalDocument && sale.fiscalStatus === FiscalStatus.ISSUED ? (
                  <div className="mt-2 space-y-2 rounded-md bg-slate-50 p-2.5 dark:bg-[#18212B] text-gray-700 dark:text-[#A9B6C2]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Número:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {String(sale.fiscalDocument.pointOfSale).padStart(5, "0")}-{String(sale.fiscalDocument.number).padStart(8, "0")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CAE:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{sale.fiscalDocument.cae}</span>
                    </div>
                    {sale.fiscalDocument.caeDueDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Vencimiento:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatDateTimeStable(sale.fiscalDocument.caeDueDate).split(" ")[0]}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                {sale.fiscalFailureReason && (
                  <p className="mt-2 rounded bg-red-50/50 p-2 text-red-600 dark:bg-red-950/20 dark:text-red-300">
                    {sale.fiscalFailureReason}
                  </p>
                )}

                {sale.fiscalDocument || sale.fiscalRequestedAt || sale.fiscalFailureReason ? (
                  <details className="mt-2 group">
                    <summary className="cursor-pointer select-none text-[11px] font-semibold text-[var(--accent)] hover:underline">
                      Ver detalle técnico
                    </summary>
                    <div className="mt-2 space-y-2 border-l-2 border-gray-100 pl-2.5 pt-1 text-[11px] text-gray-500 dark:border-[#273342] dark:text-[#7F8D9A]">
                      {sale.fiscalRequestedAt && (
                        <TotalRow
                          label="Solicitada"
                          value={formatDateTimeStable(sale.fiscalRequestedAt)}
                        />
                      )}
                      {sale.fiscalDocument && (
                        <>
                          <TotalRow
                            label="Doc. Estado"
                            value={fiscalDocumentStatusLabels[sale.fiscalDocument.status]}
                          />
                          <TotalRow
                            label="CAE"
                            value={sale.fiscalDocument.cae ?? "Pendiente"}
                          />
                        </>
                      )}
                      {sale.fiscalFailureReason && (
                        <p className="mt-1 rounded bg-red-50/50 p-1.5 text-red-600 dark:bg-red-950/20 dark:text-red-300">
                          {sale.fiscalFailureReason}
                        </p>
                      )}
                    </div>
                  </details>
                ) : null}

                {isAdminOrOwner && sale.status !== SaleStatus.CANCELLED ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#273342]">
                    <FiscalSaleActions
                      saleId={sale.id}
                      fiscalStatus={sale.fiscalStatus}
                      requiresFiscalInvoice={sale.requiresFiscalInvoice}
                      canPrepare={canPrepare}
                      canMarkNotRequested={canMarkNotRequested}
                      canCancelBeforeIssue={canCancelBeforeIssue}
                      mode="panel"
                      prepareLabel={
                        sale.fiscalStatus === FiscalStatus.READY_TO_ISSUE
                          ? "Regenerar preparacion"
                          : "Preparar factura"
                      }
                    />
                  </div>
                ) : null}

                {sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED ? (
                  <p className="mt-2 rounded bg-amber-50/50 p-2 text-[11px] leading-normal text-amber-700 dark:bg-amber-950/20 dark:text-amber-200">
                    La venta ya fue emitida fiscalmente. Requiere nota de crédito.
                  </p>
                ) : null}
              </div>
            </Card>

            {/* Card Pagos */}
            <Card className="p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#7F8D9A] border-b border-gray-100 pb-2.5 dark:border-[#273342]">
                Pagos Registrados
              </h2>
              <div className="mt-3 space-y-2">
                {sale.payments.map((payment) => {
                  const hasComplexDetails =
                    payment.paymentAttempt ||
                    payment.externalId ||
                    (payment.externalReference && payment.externalReference !== payment.externalId);

                  return (
                    <div
                      key={payment.id}
                      className="rounded-md border border-gray-100 bg-gray-50/60 p-2.5 text-xs dark:border-[#273342]/70 dark:bg-[#121922]/40"
                    >
                      <div className="flex items-center justify-between font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        <span>{paymentLabels[payment.method]}</span>
                        <span>{formatARS(payment.amount)}</span>
                      </div>

                      {/* Short details shown directly */}
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-[#7F8D9A]">
                        {payment.method === PaymentMethod.CASH && payment.receivedAmount ? (
                          <span>
                            Recibido: {formatARS(payment.receivedAmount.toString())} • Vuelto:{" "}
                            {formatARS(payment.changeAmount ? payment.changeAmount.toString() : "0")}
                          </span>
                        ) : payment.method === PaymentMethod.CREDIT && payment.installments ? (
                          <span>
                            {payment.installments} cuota{payment.installments > 1 ? "s" : ""}
                            {Number(payment.surchargeAmount) > 0 &&
                              ` • Recargo: ${formatARS(payment.surchargeAmount ? payment.surchargeAmount.toString() : "0")}`}
                          </span>
                        ) : null}
                      </div>

                      {hasComplexDetails ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer select-none text-[10px] font-semibold text-[var(--accent)] hover:underline">
                            Ver comprobante y metadata
                          </summary>
                          <div className="mt-1.5 space-y-1 border-l border-gray-200 pl-2 text-[10px] text-gray-500 dark:border-[#273342] dark:text-[#7F8D9A]">
                            {payment.paymentAttempt && (
                              <>
                                <div>MP Cuenta: {payment.paymentAttempt.mercadoPagoAccount.name}</div>
                                <div>Origen: {paymentAttemptOriginLabel(payment.paymentAttempt.origin)}</div>
                                <div>Estado: {paymentAttemptStatusLabel(payment.paymentAttempt.status)}</div>
                                {payment.paymentAttempt.providerOrderId && (
                                  <div>Orden MP: {payment.paymentAttempt.providerOrderId}</div>
                                )}
                                {payment.paymentAttempt.providerPaymentId && (
                                  <div>Pago MP: {payment.paymentAttempt.providerPaymentId}</div>
                                )}
                              </>
                            )}
                            {payment.externalId && <div>Operación: {payment.externalId}</div>}
                            {payment.externalReference &&
                              payment.externalReference !== payment.externalId && (
                                <div>Referencia: {payment.externalReference}</div>
                              )}
                            {payment.providerStatus && (
                              <div>Estado: {providerStatusLabel(payment.providerStatus)}</div>
                            )}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {sale.accountMovements.length > 0 ? (
                <div className="mt-3.5 rounded border border-amber-100 bg-amber-50/45 px-2.5 py-2 text-[11px] leading-normal text-amber-800 dark:border-amber-950/40 dark:bg-amber-950/10 dark:text-amber-100">
                  <span className="font-semibold">Cta. Corriente:</span>{" "}
                  {formatARS(sale.accountMovements[0].amount)}
                </div>
              ) : null}
            </Card>

            {canCancelSale ? (
              <Card className="border-red-200 p-4 dark:border-red-900/40 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#7F8D9A]">
                  Anular venta
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-[#A9B6C2]">
                  Se devolverá el stock y la venta quedará fuera de reportes y caja.
                </p>
                <div className="mt-3">
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
  strong = false,
  className
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        strong
          ? "flex justify-between text-base font-semibold text-gray-950 dark:text-[#F3F7FA]"
          : "flex justify-between text-gray-500 dark:text-[#A9B6C2]",
        className
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
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

function isPreparableFiscalStatus(status: FiscalStatus) {
  return (
    status === FiscalStatus.PENDING ||
    status === FiscalStatus.FAILED ||
    status === FiscalStatus.READY_TO_ISSUE
  );
}
