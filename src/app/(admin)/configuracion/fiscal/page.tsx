import { requireAdminPage } from "@/lib/admin-auth";
import { PageHeader } from "@/components/ui/page-header";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { FiscalSettingsForm } from "./fiscal-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionFiscalPage() {
  const user = await requireAdminPage();
  const setting = await getFiscalSettingOrDefault(user.businessId!);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configuración fiscal"
        description="Configurá los datos necesarios para emitir comprobantes electrónicos."
      />
      <FiscalSettingsForm setting={setting} />
    </div>
  );
}
