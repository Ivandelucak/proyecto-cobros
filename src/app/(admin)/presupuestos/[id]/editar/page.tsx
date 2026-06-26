import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateQuoteAction } from "../../actions";
import { QuoteForm } from "../../quote-form";

export const dynamic = "force-dynamic";

type EditarPresupuestoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarPresupuestoPage({ params }: EditarPresupuestoPageProps) {
  await requireQuotePage();
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { include: { category: { select: { name: true } } } }
        }
      }
    }
  });

  if (!quote) {
    redirect("/presupuestos");
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={`Editar presupuesto #${quote.quoteNumber}`}
        description="Actualiza items, validez, descuentos y condiciones."
      />
      <QuoteForm
        action={updateQuoteAction.bind(null, quote.id)}
        submitLabel="Guardar cambios"
        initialValues={{
          customerId: quote.customerId,
          customerName: quote.customerNameSnapshot,
          customerDocument: quote.customerDocumentSnapshot,
          customerPhone: quote.customerPhoneSnapshot,
          customerEmail: quote.customerEmailSnapshot,
          validUntil: quote.validUntil ? dateInput(quote.validUntil) : "",
          notes: quote.notes,
          terms: quote.terms,
          discountTotal: quote.discountTotal.toString(),
          surchargeTotal: quote.surchargeTotal.toString(),
          items: quote.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productNameSnapshot,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            unitType: item.unitTypeSnapshot,
            notes: item.notes ?? "",
            categoryName: item.product?.category.name
          }))
        }}
      />
    </section>
  );
}

async function requireQuotePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== Role.ADMIN && user.role !== Role.CASHIER) {
    redirect("/login");
  }
  return user;
}

function dateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
