import { requireAdminPage } from "@/lib/admin-auth";
import { PageHeader } from "@/components/ui/page-header";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { getProviderCredentialsPublicStatus } from "@/lib/fiscal/provider-credentials.server";
import { FiscalSettingsForm } from "./fiscal-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionFiscalPage() {
  const user = await requireAdminPage();
  const [setting, provider] = await Promise.all([
    getFiscalSettingOrDefault(user.businessId!),
    Promise.resolve(getProviderCredentialsPublicStatus())
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configuración fiscal"
        description="Configurá los datos necesarios para emitir comprobantes electrónicos."
      />
      <FiscalSettingsForm
        key={setting.updatedAt?.toISOString() ?? "new"}
        setting={setting}
        provider={provider}
      />
    </div>
  );
}
