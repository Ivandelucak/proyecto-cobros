import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { getPrintSetting, printPaperSizeLabels } from "@/lib/print-settings";
import { PrintSettingsForm } from "./print-settings-form";

export const dynamic = "force-dynamic";

export default async function ImpresionPage() {
  await requireAdminPage();

  const setting = await getPrintSetting();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Impresion"
        description="Configuracion de papel, copias e impresora para tickets."
        actions={
          <LinkButton href="/configuracion" variant="outline">
            Volver a configuracion
          </LinkButton>
        }
      />

      <PrintSettingsForm
        initialSetting={setting}
        paperSizeLabels={printPaperSizeLabels}
      />

      <Card className="p-5">
        <h2 className="text-base font-semibold text-gray-950 dark:text-[#F3F7FA]">
          Prueba de impresion
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-[#A9B6C2]">
          Para probar, abri cualquier ticket real desde Ventas, Facturacion o Caja
          y usa el boton Imprimir ticket. En navegador se abrira el dialogo del
          sistema; en la app de escritorio se usara la impresora configurada si
          esta disponible.
        </p>
      </Card>
    </section>
  );
}
