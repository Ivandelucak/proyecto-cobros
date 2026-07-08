import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireMobileAuth } from "@/lib/admin-auth";
import { getAccessibleSaleOrRedirect } from "@/lib/sale-access";
import { formatARS } from "@/lib/money";
import { formatDateTimeStable } from "@/lib/date-format";
import { SaleStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type MobileVentaDetallePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MobileVentaDetallePage({ params }: MobileVentaDetallePageProps) {
  const user = await requireMobileAuth();
  const { id } = await params;

  let saleData;
  try {
    saleData = await getAccessibleSaleOrRedirect(id);
  } catch {
    redirect("/m/ventas");
  }

  const { sale } = saleData;

  return (
    <div className="space-y-4">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <Link
          href="/m/ventas"
          className="p-2 rounded-lg bg-[#121922] border border-[#273342] text-[#A9B6C2] active:text-[#F3F7FA]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-[#F3F7FA]">Detalle de Venta</h2>
          <p className="text-xs text-[#A9B6C2]">Venta #{sale.saleNumber}</p>
        </div>
      </div>

      {/* Sale Meta Card */}
      <Card className="p-4 bg-[#121922] border-[#273342] space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#273342]">
          <span className="text-xs text-[#A9B6C2]">Estado</span>
          <Badge tone={sale.status === SaleStatus.PAID ? "green" : "red"}>
            {sale.status === SaleStatus.PAID ? "Pagada" : "Anulada"}
          </Badge>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-[#A9B6C2]">Fecha y Hora</span>
          <span className="font-semibold text-[#F3F7FA]">{formatDateTimeStable(sale.createdAt)}</span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-[#A9B6C2]">Vendedor</span>
          <span className="font-semibold text-[#F3F7FA]">{sale.user.name}</span>
        </div>

        {sale.customer && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#A9B6C2]">Cliente</span>
            <span className="font-semibold text-[#F3F7FA]">{sale.customer.name}</span>
          </div>
        )}
      </Card>

      {/* Items Section */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A] px-1">Productos</h3>
        <Card className="p-4 bg-[#121922] border-[#273342] divide-y divide-[#273342]">
          {sale.items.map((item) => (
            <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#F3F7FA] truncate">{item.productNameSnapshot}</p>
                <p className="text-xs text-[#A9B6C2] mt-0.5">
                  {item.quantity.toString()} x {formatARS(item.unitPrice)}
                </p>
              </div>
              <span className="font-bold text-sm text-[#F3F7FA] self-center">
                {formatARS(item.subtotal)}
              </span>
            </div>
          ))}
        </Card>
      </div>

      {/* Payments Section */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7F8D9A] px-1">Pagos</h3>
        <Card className="p-4 bg-[#121922] border-[#273342] divide-y divide-[#273342]">
          {sale.payments.length === 0 ? (
            <p className="py-2 text-center text-xs text-[#7F8D9A]">Sin pagos registrados.</p>
          ) : (
            sale.payments.map((payment) => (
              <div key={payment.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between">
                <div>
                  <p className="font-semibold text-sm text-[#F3F7FA]">
                    {payment.method === "CASH"
                      ? "Efectivo"
                      : payment.method === "MERCADOPAGO"
                      ? "Mercado Pago"
                      : payment.method === "DEBIT"
                      ? "Tarjeta Débito"
                      : payment.method === "CREDIT"
                      ? "Tarjeta Crédito"
                      : payment.method === "TRANSFER"
                      ? "Transferencia"
                      : payment.method === "CURRENT_ACCOUNT"
                      ? "Cuenta Corriente"
                      : payment.method}
                  </p>
                  <p className="text-[10px] text-[#A9B6C2] mt-0.5">
                    {formatDateTimeStable(payment.createdAt)}
                  </p>
                </div>
                <span className="font-bold text-sm text-[#F3F7FA] self-center">
                  {formatARS(payment.amount)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Totals Section */}
      <Card className="p-4 bg-[#121922] border-[#273342] space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[#A9B6C2]">Subtotal</span>
          <span className="font-bold text-[#F3F7FA]">{formatARS(sale.subtotal)}</span>
        </div>
        {sale.discountTotal.gt(0) && (
          <div className="flex justify-between items-center text-xs text-[#E16060]">
            <span>Descuento</span>
            <span>-{formatARS(sale.discountTotal)}</span>
          </div>
        )}
        {sale.surchargeTotal.gt(0) && (
          <div className="flex justify-between items-center text-xs text-[#28A36A]">
            <span>Recargo</span>
            <span>+{formatARS(sale.surchargeTotal)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-[#273342]">
          <span className="text-sm font-bold text-[#F3F7FA]">Total</span>
          <span className="text-lg font-black text-[#4C7FA3]">{formatARS(sale.total)}</span>
        </div>
      </Card>
    </div>
  );
}
