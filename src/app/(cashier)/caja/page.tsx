import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { CashRegister } from "./cash-register";
import { getSuggestedCashProductsAction } from "./actions";
import { CashSessionPanel } from "./cash-session-panel";
import { getCurrentUser } from "@/lib/auth";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import {
  getActiveCreditInstallmentPlans,
  getEnabledPaymentMethodSettings
} from "@/lib/payment-settings";
import { getActiveMercadoPagoAccountViews } from "@/lib/mercadopago/mercado-pago-accounts";
import { getPrintSetting } from "@/lib/print-settings";

export default async function CajaPage() {
  const user = await getCurrentUser();
  if (!user || !user.businessId) {
    redirect("/login");
  }

  const [
    cashSession,
    suggestedProducts,
    paymentMethods,
    creditPlans,
    printSetting,
    cashSetting,
    fiscalSetting,
    mercadoPagoAccounts
  ] = await Promise.all([
    getOpenCashSessionSnapshot(user.businessId),
    getSuggestedCashProductsAction(),
    getEnabledPaymentMethodSettings(user.businessId),
    getActiveCreditInstallmentPlans(),
    getPrintSetting(user.businessId),
    getCashRegisterSetting(user.businessId),
    getFiscalSettingOrDefault(user.businessId),
    getActiveMercadoPagoAccountViews(user.businessId)
  ]);

  return (
    <section className="cash-page flex min-h-[calc(100vh-8.5rem)] flex-col gap-3">
      {cashSession || !cashSetting.requireOpenSession ? (
        <CashRegister
          initialSuggestedProducts={suggestedProducts}
          paymentMethods={paymentMethods}
          creditPlans={creditPlans}
          printSetting={printSetting}
          fiscalSetting={fiscalSetting}
          mercadoPagoAccounts={mercadoPagoAccounts}
          canAccessFiscalAdmin={user?.role === Role.ADMIN}
          allowNegativeStock={cashSetting.allowNegativeStock}
        />
      ) : null}
      <div className="cash-session-wrap mt-auto">
        <CashSessionPanel
          cashSession={cashSession}
          requireOpenSession={cashSetting.requireOpenSession}
          showExpectedCash={cashSetting.showExpectedCashToCashier}
        />
      </div>
    </section>
  );
}
