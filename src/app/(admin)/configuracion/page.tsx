import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { requireAdminPage } from "@/lib/admin-auth";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import {
  getCreditInstallmentPlans,
  getPaymentMethodSettings
} from "@/lib/payment-settings";
import { getStockSetting } from "@/lib/stock-settings";
import { getTicketSetting } from "@/lib/ticket-settings";
import { BusinessProfileForm } from "./business-profile-form";
import { OperationalSettingsForm } from "./operational-settings-form";
import { PaymentSettingsForm } from "./payment-settings-form";
import { TicketSettingsForm } from "./ticket-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  await requireAdminPage();

  const [
    profile,
    paymentMethods,
    creditPlans,
    ticketSetting,
    cashSetting,
    stockSetting
  ] = await Promise.all([
    getBusinessProfileOrDefault(),
    getPaymentMethodSettings(),
    getCreditInstallmentPlans(),
    getTicketSetting(),
    getCashRegisterSetting(),
    getStockSetting()
  ]);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Configuracion"
        description="Datos basicos del comercio usados por ticket y operacion."
        actions={
          <>
            <LinkButton href="/configuracion/fiscal" variant="outline">
              Fiscal
            </LinkButton>
            <LinkButton href="/configuracion/impresion" variant="outline">
              Impresion
            </LinkButton>
            <LinkButton href="/configuracion/mantenimiento" variant="outline">
              Mantenimiento
            </LinkButton>
          </>
        }
      />
      <BusinessProfileForm
        initialValues={{
          name: profile.name,
          businessType: profile.businessType,
          cuit: profile.cuit ?? null,
          address: profile.address ?? null,
          phone: profile.phone ?? null,
          email: profile.email ?? null,
          fiscalCondition: profile.fiscalCondition ?? null,
          grossIncome: profile.grossIncome ?? null,
          activityStartDate: profile.activityStartDate ?? null,
          currency: profile.currency ?? "ARS",
          locale: profile.locale ?? "es-AR",
          timezone: profile.timezone ?? "America/Argentina/Buenos_Aires",
          preferredTheme: profile.preferredTheme ?? null,
          logoUrl: profile.logoUrl ?? null,
          website: profile.website ?? null,
          generalFooterText: profile.generalFooterText ?? null
        }}
      />
      <TicketSettingsForm setting={ticketSetting} />
      <PaymentSettingsForm methods={paymentMethods} creditPlans={creditPlans} />
      <OperationalSettingsForm cashSetting={cashSetting} stockSetting={stockSetting} />
    </section>
  );
}
