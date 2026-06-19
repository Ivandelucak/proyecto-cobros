import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getAccessibleSaleOrRedirect(saleId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      items: {
        orderBy: { productNameSnapshot: "asc" },
        include: {
          product: {
            select: {
              barcode: true,
              sku: true
            }
          }
        }
      },
      payments: {
        orderBy: { createdAt: "asc" }
      },
      cashSession: {
        select: {
          id: true,
          openedAt: true,
          closedAt: true,
          status: true
        }
      },
      customer: {
        select: {
          id: true,
          name: true,
          document: true
        }
      },
      accountMovements: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      cancelledBy: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  if (!sale) {
    redirect(user.role === Role.ADMIN ? "/ventas" : "/caja");
  }

  if (user.role !== Role.ADMIN && sale.userId !== user.id) {
    redirect("/caja");
  }

  return { sale, user };
}
