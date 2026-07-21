import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { writeProductsTemplateBuffer } from "@/lib/excel/products-export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("No autorizado.", { status: 401 });
  }

  if (user.role !== Role.ADMIN) {
    return new Response("No autorizado.", { status: 403 });
  }

  const buffer = writeProductsTemplateBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos.xlsx"'
    }
  });
}
