import {
  SettingsCard,
  SettingsSection,
  SettingsSummaryCard
} from "@/components/ui/settings";
import { requireAdminPage } from "@/lib/admin-auth";
import { getBusinessProfileOrDefault } from "@/lib/business-profile";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import {
  getPaymentMethodSettings
} from "@/lib/payment-settings";
import { getMercadoPagoAccountViews } from "@/lib/mercadopago/mercado-pago-accounts";
import { getStockSetting } from "@/lib/stock-settings";
import { getTicketSetting } from "@/lib/ticket-settings";
import { BusinessProfileForm } from "./business-profile-form";
import { OperationalSettingsForm } from "./operational-settings-form";
import { TicketSettingsForm } from "./ticket-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  await requireAdminPage();

  const [
    profile,
    paymentMethods,
    mercadoPagoAccounts,
    ticketSetting,
    cashSetting,
    stockSetting
  ] = await Promise.all([
    getBusinessProfileOrDefault(),
    getPaymentMethodSettings(),
    getMercadoPagoAccountViews(),
    getTicketSetting(),
    getCashRegisterSetting(),
    getStockSetting()
  ]);
  const activePaymentMethods = paymentMethods.filter((method) => method.enabled).length;
  const activeMercadoPagoAccounts = mercadoPagoAccounts.filter((account) => account.enabled).length;
  const qrApiEnabled =
    paymentMethods.find((method) => method.method === "MERCADOPAGO")?.mercadoPagoMode ===
    "API_QR";

  return (
    <div className="space-y-5">
      <SettingsCard>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SettingsSummaryCard
            label="Medios activos"
            value={String(activePaymentMethods)}
            hint="Configurados en Pagos"
          />
          <SettingsSummaryCard
            label="Cuentas MP"
            value={String(activeMercadoPagoAccounts)}
            hint={qrApiEnabled ? "QR API habilitado" : "Modo manual o sin QR API"}
            tone={qrApiEnabled ? "success" : "neutral"}
          />
          <SettingsSummaryCard
            label="Caja"
            value={cashSetting.requireOpenSession ? "Controlada" : "Flexible"}
            hint={cashSetting.showExpectedCashToCashier ? "Muestra efectivo esperado" : "Sin efectivo esperado"}
          />
          <SettingsSummaryCard
            label="Stock"
            value={stockSetting.lowStockEnabled ? "Alertas" : "Basico"}
            hint={stockSetting.allowManualStockAdjustment ? "Ajustes manuales permitidos" : "Ajustes restringidos"}
          />
        </div>
      </SettingsCard>
      <SettingsSection
        title="General"
        description="Datos del comercio, identidad visual y textos usados por tickets e impresiones."
      >
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
      </SettingsSection>
      <SettingsSection
        title="Ticket"
        description="Textos y datos visibles en el comprobante interno."
      >
        <TicketSettingsForm setting={ticketSetting} />
      </SettingsSection>
      <SettingsSection
        title="Caja y stock"
        description="Preferencias operativas para apertura de caja, anulaciones y alertas de stock."
      >
        <OperationalSettingsForm cashSetting={cashSetting} stockSetting={stockSetting} />
      </SettingsSection>
    </div>
  );
}
