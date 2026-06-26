import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { createQuoteAction } from "../actions";
import { QuoteForm } from "../quote-form";

export const dynamic = "force-dynamic";

export default async function NuevoPresupuestoPage() {
  await requireQuotePage();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Nuevo presupuesto"
        description="Arma una cotizacion sin afectar caja, ventas, stock ni fiscal."
      />
      <QuoteForm action={createQuoteAction} submitLabel="Guardar presupuesto" />
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
