import {
  FiscalCustomerCondition,
  FiscalDocumentIdentityType,
  FiscalStatus,
  PaymentMethod,
  SaleStatus,
  UnitType
} from "@prisma/client";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { formatDateTimeStable } from "@/lib/date-format";
import {
  fiscalDocumentLetterLabels,
  fiscalDocumentTypeLabels,
  validateFiscalReadiness
} from "@/lib/fiscal/fiscal-documents";
import {
  fiscalDocumentStatusLabels,
  fiscalStatusLabels,
  fiscalStatusTone,
  isFiscalPendingStatus
} from "@/lib/fiscal/fiscal-status";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { formatARS } from "@/lib/money";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { prisma } from "@/lib/prisma";
import { buildReturnToHref, buildSaleDetailHref, buildTicketHref } from "@/lib/return-to";
import { FiscalSaleActions } from "../fiscal-sale-actions";

export const dynamic = "force-dynamic";

type FacturacionDetallePageProps = {
  params: Promise<{
    saleId: string;
  }>;
};

export default async function FacturacionDetallePage({
  params
}: FacturacionDetallePageProps) {
  await requireAdminPage();
  const { saleId } = await params;

  const [sale, readiness, setting, paymentMethods] = await Promise.all([
    prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        fiscalDocument: {
          include: {
            items: true
          }
        },
        items: {
          orderBy: { productNameSnapshot: "asc" }
        },
        payments: {
          orderBy: { createdAt: "asc" }
        },
        user: {
          select: {
            name: true
          }
        }
      }
    }),
    validateFiscalReadiness(saleId),
    getFiscalSettingOrDefault(),
    getPaymentMethodSettings()
  ]);

  if (!sale) {
    notFound();
  }

  const paymentLabels = Object.fromEntries(
    paymentMethods.map((method) => [method.method, method.label])
  ) as Record<PaymentMethod, string>;
  const canPrepare = isPreparableFiscalStatus(sale.fiscalStatus);
  const canMarkNotRequested =
    sale.fiscalStatus === FiscalStatus.PENDING ||
    sale.fiscalStatus === FiscalStatus.FAILED;
  const canCancelBeforeIssue =
    sale.status === SaleStatus.PAID && isPreparableFiscalStatus(sale.fiscalStatus);
  const pendingAge = pendingAgeLabel(sale);
  const fiscalDocument = sale.fiscalDocument;
  const returnTo = buildReturnToHref(`/facturacion/${sale.id}`);

  return (
    <section className="space-y-5">
      <PageHeader
        title={`Detalle fiscal venta #${sale.saleNumber}`}
        description="Preview interno del comprobante preparado. No emite ni consulta ARCA."
        actions={
          <>
            <LinkButton href="/facturacion">Volver</LinkButton>
            <LinkButton href={buildSaleDetailHref(sale.id, returnTo)}>Ver venta</LinkButton>
            <LinkButton href={buildTicketHref(sale.id, returnTo)}>Ver ticket</LinkButton>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Resumen de venta
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Venta" value={`#${sale.saleNumber}`} />
              <Info label="Fecha" value={formatDateTimeStable(sale.createdAt)} />
              <Info label="Cajero" value={sale.user.name} />
              <Info
                label="Cliente"
                value={sale.customer?.name ?? sale.fiscalCustomerNameSnapshot ?? "Consumidor final"}
              />
              <Info
                label="Pago"
                value={sale.payments
                  .map((payment) => paymentLabels[payment.method])
                  .join(" + ")}
              />
              <Info label="Total" value={formatARS(sale.total)} strong />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Estado fiscal
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  Estado
                </p>
                <div className="mt-1">
                  <Badge tone={fiscalStatusTone(sale.fiscalStatus)}>
                    {fiscalStatusLabels[sale.fiscalStatus]}
                  </Badge>
                </div>
              </div>
              <Info label="Requiere factura" value={sale.requiresFiscalInvoice ? "Si" : "No"} />
              <Info label="Tiempo pendiente" value={pendingAge} />
              <Info
                label="Solicitada"
                value={
                  sale.fiscalRequestedAt
                    ? formatDateTimeStable(sale.fiscalRequestedAt)
                    : "-"
                }
              />
            </div>
            {sale.fiscalStatus === FiscalStatus.CREDIT_NOTE_REQUIRED ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
                La venta ya fue emitida fiscalmente. Requiere nota de credito.
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Datos del receptor
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info
                label="Nombre"
                value={fiscalDocument?.customerName ?? receiverName(sale)}
              />
              <Info
                label="Condicion fiscal"
                value={conditionLabel(
                  fiscalDocument?.customerCondition ??
                    sale.fiscalCustomerCondition ??
                    sale.customer?.fiscalCondition ??
                    null
                )}
              />
              <Info
                label="Tipo documento"
                value={docTypeLabel(
                  fiscalDocument?.customerDocType ??
                    sale.fiscalCustomerDocType ??
                    sale.customer?.docType ??
                    null
                )}
              />
              <Info
                label="Documento"
                value={
                  fiscalDocument?.customerDocNumber ??
                  sale.fiscalCustomerDocNumber ??
                  sale.customer?.docNumber ??
                  sale.customer?.document ??
                  "-"
                }
              />
            </div>
          </Card>

          {fiscalDocument ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                Comprobante preparado
              </h2>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Tipo" value={fiscalDocumentTypeLabels[fiscalDocument.type]} />
                <Info label="Letra" value={fiscalDocumentLetterLabels[fiscalDocument.letter]} />
                <Info label="Ambiente" value={environmentLabel(fiscalDocument.environment)} />
                <Info
                  label="Punto de venta"
                  value={fiscalDocument.pointOfSale ? String(fiscalDocument.pointOfSale) : "-"}
                />
                <Info
                  label="Estado documento"
                  value={fiscalDocumentStatusLabels[fiscalDocument.status]}
                />
                <Info
                  label="Preparacion"
                  value={formatDateTimeStable(fiscalDocument.createdAt)}
                />
                <Info
                  label="CAE"
                  value={fiscalDocument.cae ?? "Pendiente de emision"}
                />
                <Info
                  label="Numero"
                  value={
                    fiscalDocument.number
                      ? String(fiscalDocument.number)
                      : "Pendiente de emision"
                  }
                />
                <Info label="Total" value={formatARS(fiscalDocument.total)} strong />
                <Info
                  label="Neto"
                  value={fiscalDocument.netAmount ? formatARS(fiscalDocument.netAmount) : "-"}
                />
                <Info
                  label="IVA"
                  value={fiscalDocument.vatAmount ? formatARS(fiscalDocument.vatAmount) : "-"}
                />
                <Info
                  label="Exento"
                  value={
                    fiscalDocument.exemptAmount
                      ? formatARS(fiscalDocument.exemptAmount)
                      : "-"
                  }
                />
                <Info
                  label="No gravado"
                  value={
                    fiscalDocument.nonTaxedAmount
                      ? formatARS(fiscalDocument.nonTaxedAmount)
                      : "-"
                  }
                />
              </div>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Esta venta esta pendiente de preparacion fiscal.
              </h2>
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-100">
                Todavia no tiene comprobante interno preparado.
              </p>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                Items
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Descripcion</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium">Precio unitario</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                    <th className="px-4 py-3 font-medium">IVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {(fiscalDocument?.items.length ? fiscalDocument.items : sale.items).map(
                    (item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                          {"description" in item ? item.description : item.productNameSnapshot}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                          {formatQuantity(
                            item.quantity.toString(),
                            "unitTypeSnapshot" in item ? item.unitTypeSnapshot : UnitType.UNIT
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                          {formatARS(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-950 dark:text-gray-50">
                          {formatARS(item.subtotal)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                          {"vatRate" in item && item.vatRate ? `${item.vatRate}%` : "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Acciones
            </h2>
            <div className="mt-4 space-y-3">
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
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Validaciones
            </h2>
            <ValidationList
              title="Errores"
              items={readiness.errors}
              emptyText="Sin errores bloqueantes."
              tone="red"
            />
            <ValidationList
              title="Advertencias"
              items={readiness.warnings}
              emptyText="Sin advertencias."
              tone="amber"
            />
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
              Configuracion fiscal
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <Info label="Modulo fiscal" value={setting.enabled ? "Habilitado" : "Deshabilitado"} />
              <Info label="CUIT emisor" value={setting.cuit ?? "-"} />
              <Info
                label="Punto de venta"
                value={setting.pointOfSale ? String(setting.pointOfSale) : "-"}
              />
              <Info
                label="Condicion comercio"
                value={conditionLabel(setting.fiscalCondition)}
              />
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function Info({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-1 font-semibold text-gray-950 dark:text-gray-50"
            : "mt-1 text-gray-700 dark:text-gray-200"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ValidationList({
  title,
  items,
  emptyText,
  tone
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: "amber" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100";

  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item} className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{emptyText}</p>
      )}
    </div>
  );
}

function receiverName(sale: {
  fiscalCustomerNameSnapshot: string | null;
  customer: { businessName: string | null; name: string } | null;
}) {
  return (
    sale.fiscalCustomerNameSnapshot ??
    sale.customer?.businessName ??
    sale.customer?.name ??
    "Consumidor final"
  );
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

function isPreparableFiscalStatus(status: FiscalStatus) {
  return (
    status === FiscalStatus.PENDING ||
    status === FiscalStatus.FAILED ||
    status === FiscalStatus.READY_TO_ISSUE
  );
}

function conditionLabel(condition: FiscalCustomerCondition | null) {
  if (!condition) {
    return "-";
  }

  const labels: Record<FiscalCustomerCondition, string> = {
    CONSUMIDOR_FINAL: "Consumidor final",
    RESPONSABLE_INSCRIPTO: "Responsable inscripto",
    MONOTRIBUTO: "Monotributo",
    EXENTO: "Exento",
    NO_RESPONSABLE: "No responsable",
    EXTERIOR: "Exterior",
    OTHER: "Otro"
  };

  return labels[condition];
}

function docTypeLabel(docType: FiscalDocumentIdentityType | null) {
  if (!docType) {
    return "-";
  }

  const labels: Record<FiscalDocumentIdentityType, string> = {
    DNI: "DNI",
    CUIT: "CUIT",
    CUIL: "CUIL",
    CDI: "CDI",
    PASAPORTE: "Pasaporte",
    CONSUMIDOR_FINAL: "Consumidor final",
    OTHER: "Otro"
  };

  return labels[docType];
}

function environmentLabel(environment: string) {
  return environment === "PRODUCCION" ? "Produccion" : "Homologacion";
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
