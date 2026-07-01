import { Card } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-auth";
import { getPrintSetting, printPaperSizeLabels } from "@/lib/print-settings";
import { PrintSettingsForm } from "./print-settings-form";

export const dynamic = "force-dynamic";

export default async function ImpresionPage() {
  await requireAdminPage();

  const setting = await getPrintSetting();

  return (
    <div className="space-y-5">
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
    </div>
  );
}
