import { PaymentMethod, SaleStatus } from "@prisma/client";
import { getCustomerBalanceMap } from "@/lib/customer-account";
import { writeProductsExportBuffer } from "@/lib/excel/products-export";
import { prisma } from "@/lib/prisma";
import { formatInternalSaleNumber } from "@/lib/sale-numbering";
import { formatStock } from "@/lib/stock-format";

type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export async function buildProductsExport() {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null
    },
    include: {
      category: {
        select: { name: true }
      }
    },
    orderBy: { name: "asc" }
  });

  return writeProductsExportBuffer(products);
}

export async function buildSalesCsv(from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: from,
        lt: to
      }
    },
    include: {
      user: { select: { name: true, email: true } },
      customer: { select: { name: true, document: true } },
      payments: true,
      items: true
    },
    orderBy: { createdAt: "asc" }
  });

  return buildCsv(sales, [
    { header: "numero", value: (sale) => formatInternalSaleNumber(sale) },
    { header: "fecha", value: (sale) => sale.createdAt.toISOString() },
    { header: "estado", value: (sale) => sale.status },
    { header: "usuario", value: (sale) => sale.user.name },
    { header: "cliente", value: (sale) => sale.customer?.name ?? "" },
    { header: "documento_cliente", value: (sale) => sale.customer?.document ?? "" },
    { header: "subtotal", value: (sale) => sale.subtotal.toString() },
    { header: "descuentos", value: (sale) => sale.discountTotal.toString() },
    { header: "recargos", value: (sale) => sale.surchargeTotal.toString() },
    { header: "total", value: (sale) => sale.total.toString() },
    {
      header: "medios_pago",
      value: (sale) =>
        sale.payments
          .map((payment) => `${payment.method}:${payment.amount.toString()}`)
          .join(" | ")
    },
    { header: "items", value: (sale) => sale.items.length }
  ]);
}

export async function buildCustomersBalanceCsv() {
  const customers = await prisma.customer.findMany({
    where: {
      active: true,
      deletedAt: null
    },
    orderBy: { name: "asc" }
  });
  const balances = await getCustomerBalanceMap(customers.map((customer) => customer.id));

  return buildCsv(
    customers.map((customer) => ({
      ...customer,
      balance: balances.get(customer.id)?.toString() ?? "0"
    })),
    [
      { header: "cliente", value: (customer) => customer.name },
      { header: "documento", value: (customer) => customer.document ?? "" },
      { header: "telefono", value: (customer) => customer.phone ?? "" },
      { header: "email", value: (customer) => customer.email ?? "" },
      { header: "saldo", value: (customer) => customer.balance },
      { header: "activo", value: (customer) => (customer.active ? "SI" : "NO") }
    ]
  );
}

export async function buildStockCsv() {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null
    },
    include: {
      category: { select: { name: true } }
    },
    orderBy: { name: "asc" }
  });

  return buildCsv(products, [
    { header: "producto", value: (product) => product.name },
    { header: "codigo_barras", value: (product) => product.barcode ?? "" },
    { header: "sku", value: (product) => product.sku ?? "" },
    { header: "categoria", value: (product) => product.category.name },
    { header: "stock", value: (product) => product.stock.toString() },
    { header: "stock_formateado", value: (product) => formatStock(product.stock, product.unitType) },
    { header: "stock_minimo", value: (product) => product.minStock.toString() },
    {
      header: "estado_stock",
      value: (product) => (product.stock.lte(product.minStock) ? "BAJO" : "OK")
    },
    { header: "precio_venta", value: (product) => product.salePrice.toString() }
  ]);
}

export function parseExportPeriod(searchParams: URLSearchParams) {
  const fromText = searchParams.get("from") ?? dateInput(daysAgo(30));
  const toText = searchParams.get("to") ?? dateInput(new Date());
  const from = startOfDay(fromText);
  const to = nextDay(toText);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error("Periodo invalido para exportar ventas.");
  }

  return { from, to, fromText, toText };
}

export function exportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function paymentMethodLabel(method: PaymentMethod) {
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

export function saleStatusLabel(status: SaleStatus) {
  return status === SaleStatus.PAID ? "Pagada" : "Anulada";
}

function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => escapeCsv(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(column.value(row))).join(",")
  );

  return [header, ...body].join("\n");
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function nextDay(value: string) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}
