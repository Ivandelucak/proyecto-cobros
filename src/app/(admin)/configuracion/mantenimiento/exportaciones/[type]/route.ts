import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  buildCustomersBalanceCsv,
  buildProductsExport,
  buildSalesCsv,
  buildStockCsv,
  exportDateStamp,
  parseExportPeriod
} from "@/lib/maintenance/exports";

export const dynamic = "force-dynamic";

type ExportRouteProps = {
  params: Promise<{ type: string }>;
};

export async function GET(request: Request, { params }: ExportRouteProps) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("No autorizado.", { status: 401 });
  }
  if (user.role !== Role.ADMIN) {
    return new Response("No autorizado.", { status: 403 });
  }

  try {
    const { type } = await params;
    const url = new URL(request.url);

    if (type === "productos") {
      const buffer = await buildProductsExport();
      await auditExport(user.id, "productos", {});

      return fileResponse(buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `productos-${exportDateStamp()}.xlsx`
      });
    }

    if (type === "ventas") {
      const period = parseExportPeriod(url.searchParams);
      const csv = await buildSalesCsv(period.from, period.to);
      await auditExport(user.id, "ventas", {
        from: period.fromText,
        to: period.toText
      });

      return fileResponse(csv, {
        contentType: "text/csv; charset=utf-8",
        filename: `ventas-${period.fromText}-${period.toText}.csv`
      });
    }

    if (type === "clientes-saldo") {
      const csv = await buildCustomersBalanceCsv();
      await auditExport(user.id, "clientes-saldo", {});

      return fileResponse(csv, {
        contentType: "text/csv; charset=utf-8",
        filename: `clientes-saldo-${exportDateStamp()}.csv`
      });
    }

    if (type === "stock") {
      const csv = await buildStockCsv();
      await auditExport(user.id, "stock", {});

      return fileResponse(csv, {
        contentType: "text/csv; charset=utf-8",
        filename: `stock-${exportDateStamp()}.csv`
      });
    }

    return new Response("Exportacion invalida.", { status: 404 });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "No se pudo exportar la informacion.",
      { status: 400 }
    );
  }
}

async function auditExport(
  userId: string,
  type: string,
  metadata: Record<string, string>
) {
  await createAuditLog({
    userId,
    action: "DATA_EXPORTED",
    entity: "Maintenance",
    description: `Exporto datos de ${type}.`,
    metadata: {
      type,
      ...metadata
    }
  });
}

function fileResponse(
  content: Buffer | string,
  {
    contentType,
    filename
  }: {
    contentType: string;
    filename: string;
  }
) {
  return new Response(typeof content === "string" ? content : new Uint8Array(content), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
