import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import { VOUCHER_TYPE_OPTIONS } from "@/lib/fiscal/arca/arca-config";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import { ArcaStatusPanel } from "./arca-status-panel";
import { FiscalSettingsForm } from "./fiscal-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionFiscalPage() {
  await requireAdminPage();
  const setting = await getFiscalSettingOrDefault();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Configuracion fiscal"
        description="Preparacion para ARCA y facturacion electronica futura."
        actions={<LinkButton href="/configuracion">Volver</LinkButton>}
      />
      <ArcaStatusPanel
        setting={setting}
        voucherTypeOptions={VOUCHER_TYPE_OPTIONS}
      />
      <FiscalSettingsForm setting={setting} />
    </section>
  );
}
