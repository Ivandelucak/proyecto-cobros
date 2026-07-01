import { requireAdminPage } from "@/lib/admin-auth";
import { getMercadoPagoAccountViews } from "@/lib/mercadopago/mercado-pago-accounts";
import {
  getCreditInstallmentPlans,
  getPaymentMethodSettings
} from "@/lib/payment-settings";
import { PaymentSettingsForm } from "../payment-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPagosPage() {
  await requireAdminPage();

  const [paymentMethods, creditPlans, mercadoPagoAccounts] = await Promise.all([
    getPaymentMethodSettings(),
    getCreditInstallmentPlans(),
    getMercadoPagoAccountViews()
  ]);

  return (
    <div className="space-y-5">
      <PaymentSettingsForm
        methods={paymentMethods}
        creditPlans={creditPlans}
        mercadoPagoAccounts={mercadoPagoAccounts}
      />
    </div>
  );
}
