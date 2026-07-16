import {
  FiscalCustomerCondition,
  FiscalDocumentIdentityType,
  FiscalStatus,
  FiscalDocumentStatus,
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
  buildArcaInvoiceRequest,
  validateArcaPreEmission,
  type ArcaInvoiceRequestPreview,
  type ArcaPreEmissionValidation
} from "@/lib/fiscal/arca/arca-pre-emission";
import { buildInitialArcaPreflightStatus } from "@/lib/fiscal/arca/arca-preflight";
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
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
import { getPaymentMethodSettings } from "@/lib/payment-settings";
import { prisma } from "@/lib/prisma";
import { buildReturnToHref, buildSaleDetailHref, buildTicketHref } from "@/lib/return-to";
import { ArcaPreflightPanel } from "./arca-preflight-panel";
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
  const user = await requireAdminPage();
  const { saleId } = await params;

  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      businessId: user.businessId!
    },
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
  });

  if (!sale) {
    notFound();
  }

  const [readiness, setting, paymentMethods] = await Promise.all([
    validateFiscalReadiness(saleId),
    getFiscalSettingOrDefault(user.businessId!),
    getPaymentMethodSettings(user.businessId!)
  ]);

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

  const errorDetails = fiscalDocument?.responseJson && typeof fiscalDocument.responseJson === "object"
    ? (fiscalDocument.responseJson as any).errorDetails
    : null;
  const observations = fiscalDocument?.responseJson && typeof fiscalDocument.responseJson === "object"
    ? (fiscalDocument.responseJson as any).observations
    : null;
  const rawResponse = fiscalDocument?.responseJson && typeof fiscalDocument.responseJson === "object"
    ? (fiscalDocument.responseJson as any).rawResponse
    : null;

  const returnTo = buildReturnToHref(`/facturacion/${sale.id}`);
  const shouldShowArcaPreview =
    sale.requiresFiscalInvoice &&
    Boolean(fiscalDocument) &&
    sale.fiscalStatus === FiscalStatus.READY_TO_ISSUE;
  const arcaPreview = shouldShowArcaPreview && fiscalDocument
    ? buildArcaPreviewState({ sale, fiscalDocument, setting })
    : null;

  return (
    <section className="space-y-5">
      <PageHeader
        title={`Detalle fiscal venta #${formatInternalSaleNumber(sale)}`}
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
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
              Resumen de venta
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Venta" value={`#${formatInternalSaleNumber(sale)}`} />
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
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
              Estado fiscal
            </h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500 dark:text-[#7F8D9A]">
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

          {fiscalDocument?.status === FiscalDocumentStatus.FAILED && (
            <Card className="border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/20 text-red-800 dark:text-red-200">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-red-900 dark:text-red-100">
                ❌ Error en la emisión fiscal
              </h2>
              <p className="mt-2 text-sm">
                {fiscalDocument.errorMessage || "Ocurrió un error desconocido al solicitar el CAE."}
              </p>

              {(errorDetails || observations || rawResponse) && (
                <details className="mt-4 border-t border-red-200/50 pt-3 dark:border-red-900/40 text-xs">
                  <summary className="cursor-pointer font-semibold hover:text-red-900 dark:hover:text-red-100 select-none">
                    Detalle técnico de soporte (Admin)
                  </summary>
                  <div className="mt-3 space-y-3 font-mono text-xs max-h-80 overflow-auto rounded bg-black/5 p-3 dark:bg-black/30 text-red-950 dark:text-red-300">
                    {observations && observations.length > 0 && (
                      <div>
                        <span className="font-bold block">Observaciones de ARCA:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {observations.map((obs: string, idx: number) => (
                            <li key={idx}>{obs}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {errorDetails?.technicalMessage && (
                      <div>
                        <span className="font-bold block">Detalle del error:</span>
                        <pre className="whitespace-pre-wrap break-words mt-1">{errorDetails.technicalMessage}</pre>
                      </div>
                    )}
                    {rawResponse && (
                      <div>
                        <span className="font-bold block">Respuesta cruda de ARCA:</span>
                        <pre className="whitespace-pre-wrap break-words mt-1">
                          {typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
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
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
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

          {arcaPreview ? (
            <>
              <ArcaPreviewSection
                request={arcaPreview.request}
                validation={arcaPreview.validation}
              />
              <ArcaPreflightPanel
                saleId={sale.id}
                request={arcaPreview.request}
                initialResult={arcaPreview.initialPreflight}
              />
            </>
          ) : null}

          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-[#273342]">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
                Items
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-[#273342] dark:bg-[#121922] dark:text-[#7F8D9A]">
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
                        <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                          {"description" in item ? item.description : item.productNameSnapshot}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                          {formatQuantity(
                            item.quantity.toString(),
                            "unitTypeSnapshot" in item ? item.unitTypeSnapshot : UnitType.UNIT
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
                          {formatARS(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-950 dark:text-[#F3F7FA]">
                          {formatARS(item.subtotal)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-[#A9B6C2]">
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
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
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
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
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
            <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
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

function buildArcaPreviewState(input: Parameters<typeof validateArcaPreEmission>[0]) {
  const validation = validateArcaPreEmission(input);
  const request = buildArcaInvoiceRequest(input);

  return {
    validation,
    request,
    initialPreflight: buildInitialArcaPreflightStatus({
      request,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      setting: input.setting
    })
  };
}

function ArcaPreviewSection({
  request,
  validation
}: {
  request: ArcaInvoiceRequestPreview;
  validation: ArcaPreEmissionValidation;
}) {
  const hasErrors = validation.errors.length > 0;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-950 dark:text-[#F3F7FA]">
            Previsualizacion ARCA
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#A9B6C2]">
            Request interno para emision futura. No se envia a ARCA.
          </p>
        </div>
        <Badge tone={hasErrors ? "red" : "green"}>
          {hasErrors ? "Con errores" : "Lista para pre-emision"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Tipo" value={request.header.cbteTipoLabel} strong />
        <Info
          label="Estado"
          value={hasErrors ? "Con errores" : "Lista para pre-emision"}
        />
        <Info label="Ambiente" value={environmentLabel(request.meta.environment)} />
        <Info label="Servicio" value={request.meta.service} />
        <Info label="Operacion futura" value={request.meta.futureOperation} />
        <Info label="CUIT emisor" value={request.issuer.cuit ?? "-"} />
        <Info
          label="Punto de venta"
          value={request.header.ptoVta ? String(request.header.ptoVta) : "-"}
        />
        <Info
          label="Tipo comprobante"
          value={
            request.header.cbteTipo
              ? `${request.header.cbteTipo} - ${request.header.cbteTipoLabel}`
              : request.header.cbteTipoLabel
          }
        />
        <Info label="Letra" value={request.document.letterLabel} />
        <Info label="Motivo letra" value={request.document.letterReason} />
        <Info
          label="Condicion comercio"
          value={conditionLabel(request.issuer.fiscalCondition)}
        />
        <Info
          label="Condicion receptor"
          value={conditionLabel(request.receiver.fiscalCondition)}
        />
        <Info label="Concepto" value={request.detail.conceptoLabel} />
        <Info
          label="Documento receptor"
          value={`${request.receiver.docType} ${request.receiver.docNumber ?? "-"}`}
        />
        <Info
          label="Fecha comprobante"
          value={formatArcaRequestDate(request.detail.cbteFch)}
        />
        <Info label="Importe total" value={formatARS(request.detail.impTotal)} strong />
        <Info label="Neto gravado" value={formatARS(request.detail.impNeto)} />
        <Info label="IVA" value={formatARS(request.detail.impIVA)} />
        <Info label="Exento" value={formatARS(request.detail.impOpEx)} />
        <Info label="No gravado" value={formatARS(request.detail.impTotConc)} />
        <Info label="Moneda" value={request.detail.monId} />
        <Info label="Cotizacion" value={request.detail.monCotiz} />
        <Info label="Items considerados" value={String(request.items.length)} />
        <Info
          label="Tratamiento fiscal"
          value={
            request.taxSummary.treatments.length > 0
              ? request.taxSummary.treatments.join(" + ")
              : "-"
          }
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-[#273342] dark:bg-[#121922]">
          <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-[#7F8D9A]">
            Alicuotas IVA ARCA
          </h3>
          {request.taxSummary.vatGroups.length > 0 ? (
            <div className="mt-3 space-y-2 text-sm">
              {request.taxSummary.vatGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-[#273342] dark:bg-[#0B1015]"
                >
                  <span className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                    {group.description} · codigo {group.id}
                  </span>
                  <span className="text-right text-gray-600 dark:text-[#A9B6C2]">
                    Base {formatARS(group.baseImp)} / IVA {formatARS(group.importe)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-600 dark:text-[#A9B6C2]">
              Sin IVA discriminado para esta letra o tratamiento.
            </p>
          )}
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-[#273342] dark:bg-[#121922]">
          <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-[#7F8D9A]">
            Items fiscales
          </h3>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {request.items.map((item) => (
              <div
                key={`${item.description}-${item.subtotal}`}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-[#273342] dark:bg-[#0B1015]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-gray-950 dark:text-[#F3F7FA]">
                    {item.description}
                  </span>
                  <span className="text-right font-medium text-gray-950 dark:text-[#F3F7FA]">
                    {formatARS(item.subtotal)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-[#7F8D9A]">
                  {item.taxTreatmentLabel}
                  {item.vatRate ? ` · IVA ${item.vatRate}%` : ""}
                  {item.taxCode ? ` · codigo ${item.taxCode}` : ""}
                  {" · "}
                  Neto {formatARS(item.netAmount)} / IVA {formatARS(item.vatAmount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <ValidationList
            title="Errores"
            items={validation.errors}
            emptyText="Sin errores bloqueantes."
            tone="red"
          />
        </div>
        <div>
          <ValidationList
            title="Advertencias"
            items={validation.warnings}
            emptyText="Sin advertencias."
            tone="amber"
          />
        </div>
      </div>

      <details className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-[#273342] dark:bg-[#121922]">
        <summary className="cursor-pointer text-sm font-semibold text-gray-950 dark:text-[#F3F7FA] select-none">
          ⚙️ Request técnico JSON (Soporte / Administrador)
        </summary>
        <p className="mt-2 text-xs text-gray-500 dark:text-[#7F8D9A]">
          Este JSON contiene la estructura interna que se envía al motor fiscal de ARCA. No contiene firmas, claves de acceso ni certificados.
        </p>
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-md bg-white p-4 text-xs text-gray-800 dark:bg-[#0B1015] dark:text-[#F3F7FA]">
          {JSON.stringify(request, null, 2)}
        </pre>
      </details>

    </Card>
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
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-[#7F8D9A]">
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-1 font-semibold text-gray-950 dark:text-[#F3F7FA]"
            : "mt-1 text-gray-700 dark:text-[#A9B6C2]"
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
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-[#7F8D9A]">
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
        <p className="mt-2 text-sm text-gray-600 dark:text-[#A9B6C2]">{emptyText}</p>
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

function formatArcaRequestDate(value: string) {
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
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
