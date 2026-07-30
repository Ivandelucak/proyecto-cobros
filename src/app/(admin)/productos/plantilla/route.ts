import { getCurrentUser } from "@/lib/auth";
import { writeProductsTemplateBuffer } from "@/lib/excel/products-export";
import { canImportExportProducts } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("No autorizado.", { status: 401 });
  }

  if (!canImportExportProducts(user.role)) {
    return new Response("Acceso denegado.", { status: 403 });
  }

  const buffer = writeProductsTemplateBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos.xlsx"'
    }
  });
}
