import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { writeProductsExportBuffer } from "@/lib/excel/products-export";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("No autorizado.", { status: 401 });
  }

  if (user.role !== Role.ADMIN) {
    return new Response("No autorizado.", { status: 403 });
  }

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
  const buffer = writeProductsExportBuffer(products);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="productos-${dateStamp()}.xlsx"`
    }
  });
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
