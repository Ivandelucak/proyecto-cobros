import { PaymentMethod, Prisma, Role, SaleStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { formatARS } from "@/lib/money";
import { fallbackPaymentLabels, providerStatusLabel } from "@/lib/payment-display";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { prisma } from "@/lib/prisma";
import { buildReturnToHref, buildSaleDetailHref, buildTicketHref } from "@/lib/return-to";

export const dynamic = "force-dynamic";

type VentasPageProps = {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    status?: string;
    method?: string;
  }>;
};

export default async function VentasPage({ searchParams }: VentasPageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const status = parseSaleStatus(params.status);
  const method = parsePaymentMethod(params.method);
  const returnTo = buildReturnToHref("/ventas", params);
  const where = buildSaleWhere({
    q,
    from,
    to,
    status,
    method,
    userId: user?.role === Role.CASHIER ? user.id : null
  });

  const [sales, paymentMethods] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        cashSession: {
          select: {
            id: true,
            openedAt: true
          }
        },
        customer: {
          select: { name: true }
        },
        payments: {
          orderBy: { createdAt: "asc" }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    getPaymentMethodSettings()
  ]);
  const paymentLabels = {
    ...fallbackPaymentLabels,
    ...Object.fromEntries(paymentMethods.map((method) => [method.method, method.label]))
  } as Record<PaymentMethod, string>;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Ventas"
        description="Listado de ventas, pagos usados, caja asociada y acceso a detalle o ticket."
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(220px,1fr)_150px_150px_170px_220px_auto]">
          <Input
            name="q"
            placeholder="Buscar por numero, cajero, producto o referencia"
            defaultValue={q}
          />
          <Input name="from" type="date" defaultValue={from} />
          <Input name="to" type="date" defaultValue={to} />
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">Todos los estados</option>
            <option value="PAID">Pagadas</option>
            <option value="CANCELLED">Anuladas</option>
          </Select>
          <Select name="method" defaultValue={method ?? ""}>
            <option value="">Todos los pagos</option>
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
        </form>
      </Card>

      {sales.length === 0 ? (
        <EmptyState
          title="No hay ventas para mostrar"
          description="Ajusta los filtros o registra una venta desde caja."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
                <tr>
                  <th className="px-3 py-2 font-medium">Venta</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Cajero</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Caja</th>
                  <th className="px-3 py-2 font-medium">Items</th>
                  <th className="px-3 py-2 font-medium">Pagos</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                  >
                    <td className="px-3 py-2 font-medium text-gray-950 dark:text-[#F3F7FA]">
                      #{sale.saleNumber}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-[#A9B6C2]">
                      {formatDateTimeStable(sale.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                        {sale.user.name}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-[#7F8D9A]">
                        {sale.user.email}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-[#A9B6C2]">
                      {sale.customer?.name ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {sale.cashSession ? (
                        <Badge tone="blue">Caja {sale.cashSession.id.slice(-6)}</Badge>
                      ) : (
                        <span className="text-gray-500 dark:text-[#7F8D9A]">Sin caja</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-[#A9B6C2]">
                      {sale._count.items}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {sale.payments.map((payment) => {
                          const cleanLabel = getCleanPaymentMethodLabel(
                            payment.method,
                            paymentLabels[payment.method],
                            payment.providerStatus
                          );
                          const ref = payment.externalReference ?? payment.externalId;
                          const shortRef = getCleanReference(ref);
                          return (
                            <div key={payment.id} className="min-w-0">
                              <Badge tone="gray">{cleanLabel}</Badge>
                              {shortRef ? (
                                <p className="mt-0.5 max-w-40 truncate text-[10px] text-gray-500 dark:text-[#7F8D9A]">
                                  {shortRef}
                                </p>
                              ) : providerStatusLabel(payment.providerStatus) ? (
                                <p className="mt-0.5 max-w-40 truncate text-[10px] text-gray-500 dark:text-[#7F8D9A]">
                                  {providerStatusLabel(payment.providerStatus)}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-950 dark:text-[#F3F7FA]">
                      {formatARS(sale.total)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
                        {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <LinkButton
                          href={buildSaleDetailHref(sale.id, returnTo)}
                          size="sm"
                          variant="outline"
                        >
                          Detalle
                        </LinkButton>
                        <LinkButton
                          href={buildTicketHref(sale.id, returnTo)}
                          size="sm"
                          variant="secondary"
                        >
                          Ticket
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

function buildSaleWhere({
  q,
  from,
  to,
  status,
  method,
  userId
}: {
  q: string;
  from: string;
  to: string;
  status: SaleStatus | null;
  method: PaymentMethod | null;
  userId: string | null;
}) {
  const filters: Prisma.SaleWhereInput[] = [];

  if (userId) {
    filters.push({ userId });
  }

  if (from || to) {
    filters.push({
      createdAt: {
        ...(from ? { gte: startOfDay(from) } : {}),
        ...(to ? { lt: nextDay(to) } : {})
      }
    });
  }

  if (status) {
    filters.push({ status });
  }

  if (method) {
    filters.push({
      payments: {
        some: { method }
      }
    });
  }

  if (q) {
    const numberQuery = Number(q.replace("#", ""));
    const searchFilters: Prisma.SaleWhereInput[] = [
      { user: { name: { contains: q } } },
      { user: { email: { contains: q } } },
      { items: { some: { productNameSnapshot: { contains: q } } } },
      { payments: { some: { externalId: { contains: q } } } },
      { payments: { some: { externalReference: { contains: q } } } },
      { payments: { some: { providerStatus: { contains: q } } } }
    ];

    if (Number.isInteger(numberQuery) && numberQuery > 0) {
      searchFilters.unshift({ saleNumber: numberQuery });
    }

    filters.push({ OR: searchFilters });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

function parsePaymentMethod(value: string | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(PaymentMethod).includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
}

function parseSaleStatus(value: string | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(SaleStatus).includes(value as SaleStatus)
    ? (value as SaleStatus)
    : null;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function nextDay(value: string) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

function getCleanPaymentMethodLabel(method: PaymentMethod, fallbackLabel: string, providerStatus?: string | null) {
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

function getCleanReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (trimmed.length > 12) {
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }
  return trimmed;
}
