import { CustomerAccountMovementType, PaymentMethod } from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCustomerBalance } from "@/lib/customer-account";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildReturnToHref, buildSaleDetailHref } from "@/lib/return-to";
import { CustomerAdjustmentForm, CustomerPaymentForm } from "./account-forms";

export const dynamic = "force-dynamic";

type ClienteDetallePageProps = {
  params: Promise<{ id: string }>;
};

const movementLabels: Record<CustomerAccountMovementType, string> = {
  DEBIT: "Venta fiada",
  PAYMENT: "Pago",
  ADJUSTMENT: "Ajuste",
  SALE_CANCELLED: "Anulacion"
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

export default async function ClienteDetallePage({ params }: ClienteDetallePageProps) {
  const user = await requireAdminPage();
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: {
      id,
      businessId: user.businessId!
    },
    include: {
      accountMovements: {
        include: { user: { select: { name: true } }, sale: { select: { saleNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      },
      sales: {
        include: { payments: true },
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!customer) {
    notFound();
  }

  const balance = await getCustomerBalance(customer.id);
  const returnTo = buildReturnToHref(`/clientes/${customer.id}`);

  return (
    <section className="space-y-5">
      <PageHeader
        title={customer.name}
        description="Detalle de cliente, ventas y cuenta corriente."
        actions={
          <>
            <LinkButton href="/clientes">Volver</LinkButton>
            <LinkButton href={`/clientes/${customer.id}/editar`} variant="primary">
              Editar
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Info label="Documento" value={customer.document} />
              <Info label="Telefono" value={customer.phone} />
              <Info label="Email" value={customer.email} />
              <Info label="Direccion" value={customer.address} />
              <Info label="Estado" value={customer.active ? "Activo" : "Inactivo"} />
              <Info
                label="Condicion fiscal"
                value={customer.fiscalCondition ? fiscalConditionLabel(customer.fiscalCondition) : null}
              />
              <Info
                label="Documento fiscal"
                value={
                  customer.docType || customer.docNumber
                    ? [customer.docType, customer.docNumber].filter(Boolean).join(" ")
                    : null
                }
              />
              <Info label="Razon social" value={customer.businessName} />
              <Info label="Domicilio fiscal" value={customer.taxAddress} />
              <div>
                <p className="text-sm text-gray-500 dark:text-[#7F8D9A]">Saldo actual</p>
                <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-[#F3F7FA]">
                  {formatARS(balance)}
                </p>
              </div>
            </div>
            {customer.notes ? (
              <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-[#121922] dark:text-[#A9B6C2]">
                {customer.notes}
              </p>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-[#273342]">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Movimientos de cuenta
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Motivo</th>
                    <th className="px-4 py-3 font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {customer.accountMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {formatDateTimeStable(movement.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={movement.type === "DEBIT" ? "amber" : "green"}>
                          {movementLabels[movement.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                        {movement.reason}
                        {movement.sale ? ` (#${movement.sale.saleNumber})` : ""}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(movement.amount)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(movement.newBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-[#273342]">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Ventas asociadas
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {customer.sales.length === 0 ? (
                <p className="p-5 text-sm text-gray-500 dark:text-[#7F8D9A]">
                  Sin ventas asociadas.
                </p>
              ) : (
                customer.sales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                        Venta #{sale.saleNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[#7F8D9A]">
                        {sale.payments.map((payment) => paymentLabels[payment.method]).join(" + ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-950 dark:text-[#F3F7FA]">
                        {formatARS(sale.total)}
                      </p>
                      <LinkButton href={buildSaleDetailHref(sale.id, returnTo)} size="sm">
                        Ver
                      </LinkButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <CustomerPaymentForm customerId={customer.id} />
          <CustomerAdjustmentForm customerId={customer.id} />
        </aside>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-[#7F8D9A]">{label}</p>
      <p className="mt-1 font-medium text-gray-950 dark:text-[#F3F7FA]">{value || "-"}</p>
    </div>
  );
}

function fiscalConditionLabel(value: string) {
  const labels: Record<string, string> = {
    CONSUMIDOR_FINAL: "Consumidor final",
    RESPONSABLE_INSCRIPTO: "Responsable inscripto",
    MONOTRIBUTO: "Monotributo",
    EXENTO: "Exento",
    NO_RESPONSABLE: "No responsable",
    EXTERIOR: "Exterior",
    OTHER: "Otro"
  };

  return labels[value] ?? value;
}
