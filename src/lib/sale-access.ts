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
        orderBy: { createdAt: "asc" },
        include: {
          paymentAttempt: {
            select: {
              id: true,
              externalReference: true,
              providerOrderId: true,
              providerPaymentId: true,
              status: true,
              origin: true,
              rawStatus: true,
              rawStatusDetail: true,
              mercadoPagoAccount: {
                select: {
                  name: true,
                  environment: true
                }
              }
            }
          }
        }
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
      fiscalDocument: {
        select: {
          id: true,
          type: true,
          letter: true,
          status: true,
          environment: true,
          pointOfSale: true,
          number: true,
          cae: true,
          issueDate: true,
          errorMessage: true
        }
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
