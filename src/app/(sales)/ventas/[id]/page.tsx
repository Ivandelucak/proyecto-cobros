import { PaymentMethod, Role, SaleStatus, UnitType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { getAccessibleSaleOrRedirect } from "@/lib/sale-access";
import { CancelSaleForm } from "./cancel-sale-form";

export const dynamic = "force-dynamic";

type VentaDetallePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function VentaDetallePage({ params }: VentaDetallePageProps) {
  const { id } = await params;
  const [{ sale, user }, paymentMethods, cashSetting] = await Promise.all([
    getAccessibleSaleOrRedirect(id),
    getPaymentMethodSettings(),
    getCashRegisterSetting()
  ]);
  const backHref = user.role === Role.ADMIN ? "/ventas" : "/caja";
  const canCancelSale =
    sale.status === SaleStatus.PAID &&
    (user.role === Role.ADMIN || cashSetting.allowCashierCancelSale);
  const paymentLabels = Object.fromEntries(
    paymentMethods.map((method) => [method.method, method.label])
  ) as Record<PaymentMethod, string>;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-950 dark:bg-neutral-950 dark:text-gray-50">
      <section className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          title={`Venta #${sale.saleNumber}`}
          description={`Confirmada el ${formatDateTimeStable(sale.createdAt)} por ${sale.user.name}.`}
          actions={
            <>
              <LinkButton href={backHref}>Volver</LinkButton>
              <LinkButton href={`/ventas/${sale.id}/ticket`} variant="primary">
                Ver ticket
              </LinkButton>
            </>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                Productos
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
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
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                        {item.productNameSnapshot}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {formatQuantity(item.quantity.toString(), item.unitTypeSnapshot)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {formatARS(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
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
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Estado
                  </p>
                  <div className="mt-2">
                    <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                      {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-gray-50">
                    {formatARS(sale.total)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm dark:border-neutral-800">
                <TotalRow label="Subtotal" value={formatARS(sale.subtotal)} />
                <TotalRow label="Descuento" value={formatARS(sale.discountTotal)} />
                <TotalRow label="Recargo" value={formatARS(sale.surchargeTotal)} />
                <TotalRow label="Total" value={formatARS(sale.total)} strong />
              </div>

              <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm dark:border-neutral-800">
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
              <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                Pagos
              </h2>
              <div className="mt-4 space-y-3">
                {sale.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-950 dark:text-gray-50">
                          {paymentLabels[payment.method]}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {paymentDescription(payment)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-950 dark:text-gray-50">
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
                <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                  Anular venta
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
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
          ? "flex justify-between text-base font-semibold text-gray-950 dark:text-gray-50"
          : "flex justify-between text-gray-600 dark:text-gray-300"
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
}) {
  if (payment.method === PaymentMethod.CASH && payment.receivedAmount) {
    return `Recibido ${formatARS(payment.receivedAmount as string)} - Vuelto ${formatARS(
      (payment.changeAmount as string) ?? 0
    )}`;
  }

  if (payment.method === PaymentMethod.CREDIT && payment.installments) {
    return `${payment.installments} cuota${
      payment.installments > 1 ? "s" : ""
    } - Recargo ${formatARS((payment.surchargeAmount as string) ?? 0)}`;
  }

  return "Pago aplicado";
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
