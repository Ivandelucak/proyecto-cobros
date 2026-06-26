import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { BrowserPrintButton } from "@/components/ui/browser-print-button";
import { LinkButton } from "@/components/ui/link-button";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";
import { prisma } from "@/lib/prisma";
import { QuotePrintTemplate } from "./quote-template-modern";

export const dynamic = "force-dynamic";

type ImprimirPresupuestoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImprimirPresupuestoPage({
  params
}: ImprimirPresupuestoPageProps) {
  await requireQuotePage();
  const { id } = await params;
  const [business, quote] = await Promise.all([
    getBusinessProfileOrDefault(),
    prisma.quote.findUnique({
      where: { id },
      include: {
        customer: { select: { address: true } },
        createdBy: { select: { name: true } },
        items: { orderBy: { id: "asc" } }
      }
    })
  ]);

  if (!quote) {
    redirect("/presupuestos");
  }

  return (
    <main className="quote-print-page min-h-screen overflow-x-auto bg-slate-100 px-4 py-6 text-slate-950 dark:bg-neutral-950 print:overflow-visible print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html,
          body,
          .quote-print-page {
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .quote-print-controls {
            display: none !important;
          }
          .quote-print-sheet,
          .quote-print-sheet * {
            visibility: visible !important;
          }
          .quote-print-sheet {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            color: #020617 !important;
            background: #fff !important;
          }
          .quote-print-row,
          .quote-print-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="quote-print-controls mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/presupuestos/${quote.id}`} variant="outline">
            Volver
          </LinkButton>
          <BrowserPrintButton label="Imprimir" />
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Usar imprimir para guardar como PDF.
        </p>
      </div>

      <QuotePrintTemplate business={business} quote={quote} />
    </main>
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
