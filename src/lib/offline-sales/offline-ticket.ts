import type { OfflineCashSale } from "@/lib/offline-sales/types";

export function printOfflineTicket(sale: OfflineCashSale) {
  const popup = window.open("", "_blank", "popup,width=420,height=720");
  if (!popup) {
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  const lines = sale.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.nameSnapshot)}<br><small>${escapeHtml(item.quantity)} x ${formatMoney(item.unitPriceSnapshot)}</small></td><td>${formatMoney(item.subtotal)}</td></tr>`
    )
    .join("");

  popup.document.write(`<!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(sale.offlineNumber)}</title>
    <style>body{font-family:ui-monospace,monospace;color:#000;margin:0;padding:16px}main{max-width:320px;margin:auto}h1,p{text-align:center;margin:0 0 8px}h1{font-size:16px}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:5px 0;border-bottom:1px dashed #777;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}small{font-size:11px}.total{font-size:18px;font-weight:700}.notice{border:1px solid #000;padding:8px;font-size:11px;font-weight:700}</style>
    </head><body><main><h1>COMPROBANTE INTERNO</h1><p>${escapeHtml(sale.offlineNumber)}</p><p>${escapeHtml(new Date(sale.occurredAt).toLocaleString("es-AR"))}</p>
    <table>${lines}</table><p class="total">TOTAL ${formatMoney(sale.total)}</p><p>Efectivo ${formatMoney(sale.cashReceived)}</p><p>Vuelto ${formatMoney(sale.changeAmount)}</p>
    <p class="notice">VENTA PENDIENTE DE SINCRONIZACION<br>NO VALIDO COMO COMPROBANTE FISCAL</p></main><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value));
}
