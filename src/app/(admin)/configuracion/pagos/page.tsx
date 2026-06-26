import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "@/lib/admin-auth";
import {
  getCreditInstallmentPlans,
  getPaymentMethodSettings
} from "@/lib/payment-settings";
import { PaymentSettingsForm } from "../payment-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPagosPage() {
  await requireAdminPage();

  const [paymentMethods, creditPlans] = await Promise.all([
    getPaymentMethodSettings(),
    getCreditInstallmentPlans()
  ]);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Medios de pago"
        description="Configuracion manual para Mercado Pago, transferencia, tarjetas, efectivo y cuenta corriente."
        actions={<LinkButton href="/configuracion">Volver</LinkButton>}
      />
      <PaymentSettingsForm methods={paymentMethods} creditPlans={creditPlans} />
    </section>
  );
}
