import { FiscalStatus, PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { formatDateTimeStable } from "@/lib/date-format";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import {
  fiscalStatusLabels,
  fiscalStatusTone,
  isFiscalPendingStatus
} from "@/lib/fiscal/fiscal-status";
import { formatARS } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { FiscalSaleActions } from "./fiscal-sale-actions";
import styles from "./facturacion-responsive.module.css";

export const dynamic = "force-dynamic";

type FacturacionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FiscalStatusFilter = FiscalStatus | "ALL";

const filterLabels: Array<{ label: string; value: FiscalStatus | "ALL" }> = [
  { label: "Todas", value: "ALL" },
  { label: "Ticket interno", value: FiscalStatus.NOT_REQUESTED },
  { label: "Pendientes", value: FiscalStatus.PENDING },
  { label: "Preparadas", value: FiscalStatus.READY_TO_ISSUE },
  { label: "Fallidas", value: FiscalStatus.FAILED },
  { label: "Anuladas antes", value: FiscalStatus.CANCELLED_BEFORE_ISSUE },
  { label: "Nota credito", value: FiscalStatus.CREDIT_NOTE_REQUIRED },
  { label: "Emitidas", value: FiscalStatus.ISSUED },
  { label: "Anuladas con nota", value: FiscalStatus.CANCELLED_BY_CREDIT_NOTE }
];

export default async function FacturacionPage({
  searchParams
}: FacturacionPageProps) {
  await requireAdminPage();
  const params = (await searchParams) ?? {};
  const statusFilter = parseFiscalStatusFilter(param(params.status));
  const paymentMethod = parsePaymentMethod(param(params.paymentMethod));
  const query = param(params.q).trim();
  const from = parseDate(param(params.from));
  const to = parseDate(param(params.to), true);
  const setting = await getFiscalSettingOrDefault();

  const where: Prisma.SaleWhereInput = {
    ...buildFiscalStatusWhere(statusFilter),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(paymentMethod ? { payments: { some: { method: paymentMethod } } } : {}),
    ...(query
      ? {
          OR: [
            { customer: { name: { contains: query } } },
            { fiscalCustomerNameSnapshot: { contains: query } },
            ...(Number.isFinite(Number(query))
              ? [{ saleNumber: Number(query) }]
              : [])
          ]
        }
      : {})
  };

  const [sales, counts] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        payments: { select: { method: true } },
        fiscalDocument: {
          select: {
            id: true,
            status: true,
            type: true,
            letter: true,
            pointOfSale: true,
            number: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.sale.groupBy({
      by: ["fiscalStatus"],
      _count: { _all: true }
    })
  ]);

  const countMap = new Map(
    counts.map((item) => [item.fiscalStatus, item._count._all])
  );
  const criticalCount = sales.filter(
    (sale) => pendingPriority(sale, setting) === "critica"
  ).length;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Facturacion"
        description="Cola preparatoria para ARCA. No emite comprobantes reales todavia."
        actions={<LinkButton href="/configuracion/fiscal">Configurar fiscal</LinkButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pendientes" value={String(countMap.get(FiscalStatus.PENDING) ?? 0)} />
        <Metric
          label="Preparadas"
          value={String(countMap.get(FiscalStatus.READY_TO_ISSUE) ?? 0)}
        />
        <Metric label="Fallidas" value={String(countMap.get(FiscalStatus.FAILED) ?? 0)} />
        <Metric label="Criticas visibles" value={String(criticalCount)} />
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_150px_150px_auto]">
          <Input name="q" placeholder="Cliente o venta #" defaultValue={query} />
          <Select name="status" defaultValue={statusFilter}>
            {filterLabels.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </Select>
          <Select name="paymentMethod" defaultValue={paymentMethod ?? ""}>
            <option value="">Todos los pagos</option>
            {Object.values(PaymentMethod).map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabel(method)}
              </option>
            ))}
          </Select>
          <Input name="from" type="date" defaultValue={param(params.from)} />
          <div className="flex gap-2">
            <Input name="to" type="date" defaultValue={param(params.to)} />
            <Button type="submit">Filtrar</Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-3 xl:hidden">
        {sales.length === 0 ? (
          <Card className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Sin ventas para el filtro seleccionado.
          </Card>
        ) : (
          sales.map((sale) => {
            const priority = pendingPriority(sale, setting);
            const canPrepare = isPreparableFiscalStatus(sale.fiscalStatus);
            const canMarkNotRequested =
              sale.fiscalStatus === FiscalStatus.PENDING ||
              sale.fiscalStatus === FiscalStatus.FAILED;
            const canCancelBeforeIssue =
              sale.status === SaleStatus.PAID &&
              isPreparableFiscalStatus(sale.fiscalStatus);
            const customer =
              sale.customer?.name ??
              sale.fiscalCustomerNameSnapshot ??
              "Consumidor final";
            const paymentLabel = sale.payments
              .map((payment) => paymentMethodLabel(payment.method))
              .join(" + ");

            return (
              <Card key={sale.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-950 dark:text-gray-50">
                      #{sale.saleNumber} · {paymentLabel || "Sin pago"}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                      {customer} · {formatDateTimeStable(sale.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-sm font-semibold text-gray-950 dark:text-gray-50">
                    {formatARS(sale.total)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={fiscalStatusTone(sale.fiscalStatus)}>
                    {fiscalStatusLabels[sale.fiscalStatus]}
                  </Badge>
                  <Badge tone={priorityTone(priority)}>
                    {pendingAgeLabel(sale)}
                  </Badge>
                  {sale.fiscalDocument ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {sale.fiscalDocument.letter}
                      {sale.fiscalDocument.pointOfSale
                        ? ` PV ${sale.fiscalDocument.pointOfSale}`
                        : ""}{" "}
                      {sale.fiscalDocument.number
                        ? `#${sale.fiscalDocument.number}`
                        : "sin numero"}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3">
                  <FiscalSaleActions
                    saleId={sale.id}
                    fiscalStatus={sale.fiscalStatus}
                    requiresFiscalInvoice={sale.requiresFiscalInvoice}
                    canPrepare={canPrepare}
                    canMarkNotRequested={canMarkNotRequested}
                    canCancelBeforeIssue={canCancelBeforeIssue}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card className="hidden overflow-hidden xl:block">
        <div className="overflow-x-auto">
          <table className={`${styles.fiscalTable} w-full min-w-[1080px] text-left text-sm`}>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Venta</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado fiscal</th>
                <th className="px-4 py-3 font-medium">Pendiente</th>
                <th className={`${styles.fiscalActionsColumn} w-[240px] px-3 py-3 font-medium`}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Sin ventas para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const priority = pendingPriority(sale, setting);
                  const canPrepare = isPreparableFiscalStatus(sale.fiscalStatus);
                  const canMarkNotRequested =
                    sale.fiscalStatus === FiscalStatus.PENDING ||
                    sale.fiscalStatus === FiscalStatus.FAILED;
                  const canCancelBeforeIssue =
                    sale.status === SaleStatus.PAID &&
                    isPreparableFiscalStatus(sale.fiscalStatus);

                  return (
                    <tr key={sale.id}>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                        #{sale.saleNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {formatDateTimeStable(sale.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {sale.customer?.name ?? sale.fiscalCustomerNameSnapshot ?? "Consumidor final"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {sale.payments.map((payment) => paymentMethodLabel(payment.method)).join(" + ")}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                        {formatARS(sale.total)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={fiscalStatusTone(sale.fiscalStatus)}>
                          {fiscalStatusLabels[sale.fiscalStatus]}
                        </Badge>
                        {sale.fiscalDocument ? (
                          <p className="mt-1 text-xs text-gray-500">
                            {sale.fiscalDocument.letter}
                            {sale.fiscalDocument.pointOfSale
                              ? ` PV ${sale.fiscalDocument.pointOfSale}`
                              : ""}{" "}
                            {sale.fiscalDocument.number
                              ? `#${sale.fiscalDocument.number}`
                              : "sin numero"}
                          </p>
                        ) : null}
                      </td>
                      <td className={`${styles.fiscalActionsColumn} w-[240px] px-3 py-3 align-top`}>
                        <Badge tone={priorityTone(priority)}>
                          {pendingAgeLabel(sale)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <FiscalSaleActions
                          saleId={sale.id}
                          fiscalStatus={sale.fiscalStatus}
                          requiresFiscalInvoice={sale.requiresFiscalInvoice}
                          canPrepare={canPrepare}
                          canMarkNotRequested={canMarkNotRequested}
                          canCancelBeforeIssue={canCancelBeforeIssue}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-gray-50">
        {value}
      </p>
    </Card>
  );
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseFiscalStatusFilter(value: string): FiscalStatusFilter {
  if (value === "ALL") {
    return "ALL";
  }

  return Object.values(FiscalStatus).includes(value as FiscalStatus)
    ? (value as FiscalStatus)
    : "ALL";
}

function buildFiscalStatusWhere(statusFilter: FiscalStatusFilter): Prisma.SaleWhereInput {
  if (statusFilter === "ALL") {
    return {};
  }

  if (statusFilter === FiscalStatus.PENDING) {
    return {
      requiresFiscalInvoice: true,
      fiscalStatus: { in: [FiscalStatus.PENDING, FiscalStatus.READY_TO_ISSUE] },
      status: { not: SaleStatus.CANCELLED }
    };
  }

  if (
    statusFilter === FiscalStatus.READY_TO_ISSUE ||
    statusFilter === FiscalStatus.FAILED ||
    statusFilter === FiscalStatus.CREDIT_NOTE_REQUIRED
  ) {
    return {
      requiresFiscalInvoice: true,
      fiscalStatus: statusFilter,
      status: { not: SaleStatus.CANCELLED }
    };
  }

  return { fiscalStatus: statusFilter };
}

function parsePaymentMethod(value: string) {
  return Object.values(PaymentMethod).includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
}

function parseDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function isPreparableFiscalStatus(status: FiscalStatus) {
  return (
    status === FiscalStatus.PENDING ||
    status === FiscalStatus.FAILED ||
    status === FiscalStatus.READY_TO_ISSUE
  );
}

function pendingPriority(
  sale: { fiscalStatus: FiscalStatus; fiscalRequestedAt: Date | null; createdAt: Date },
  setting: { pendingWarningMinutes: number; pendingCriticalMinutes: number }
) {
  if (!isFiscalPendingStatus(sale.fiscalStatus)) {
    return "normal";
  }

  const startedAt = sale.fiscalRequestedAt ?? sale.createdAt;
  const ageMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);
  if (ageMinutes >= setting.pendingCriticalMinutes) {
    return "critica";
  }
  if (ageMinutes >= setting.pendingWarningMinutes) {
    return "advertencia";
  }
  return "normal";
}

function pendingAgeLabel(sale: {
  fiscalStatus: FiscalStatus;
  fiscalRequestedAt: Date | null;
  createdAt: Date;
}) {
  if (!isFiscalPendingStatus(sale.fiscalStatus)) {
    return "-";
  }

  const startedAt = sale.fiscalRequestedAt ?? sale.createdAt;
  const ageMinutes = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
  if (ageMinutes < 60) {
    return `${ageMinutes} min`;
  }
  return `${Math.floor(ageMinutes / 60)} h ${ageMinutes % 60} min`;
}

function priorityTone(priority: string) {
  if (priority === "critica") {
    return "red" as const;
  }
  if (priority === "advertencia") {
    return "amber" as const;
  }
  return "gray" as const;
}

function paymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Efectivo",
    DEBIT: "Debito",
    CREDIT: "Credito",
    TRANSFER: "Transferencia",
    MERCADOPAGO: "MercadoPago",
    CURRENT_ACCOUNT: "Cuenta corriente"
  };

  return labels[method];
}
