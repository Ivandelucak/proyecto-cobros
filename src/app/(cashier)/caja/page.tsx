import { CashRegister } from "./cash-register";
import { getSuggestedCashProductsAction } from "./actions";
import { CashSessionPanel } from "./cash-session-panel";
import { getCashRegisterSetting } from "@/lib/cash-register-settings";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";
import { getFiscalSettingOrDefault } from "@/lib/fiscal/fiscal-settings";
import {
  getActiveCreditInstallmentPlans,
  getEnabledPaymentMethodSettings
} from "@/lib/payment-settings";
import { getPrintSetting } from "@/lib/print-settings";

export default async function CajaPage() {
  const [
    cashSession,
    suggestedProducts,
    paymentMethods,
    creditPlans,
    printSetting,
    cashSetting,
    fiscalSetting
  ] = await Promise.all([
    getOpenCashSessionSnapshot(),
    getSuggestedCashProductsAction(),
    getEnabledPaymentMethodSettings(),
    getActiveCreditInstallmentPlans(),
    getPrintSetting(),
    getCashRegisterSetting(),
    getFiscalSettingOrDefault()
  ]);

  return (
    <section className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4">
      {cashSession || !cashSetting.requireOpenSession ? (
        <CashRegister
          initialSuggestedProducts={suggestedProducts}
          paymentMethods={paymentMethods}
          creditPlans={creditPlans}
          printSetting={printSetting}
          fiscalSetting={fiscalSetting}
        />
      ) : null}
      <div className="mt-auto">
        <CashSessionPanel
          cashSession={cashSession}
          requireOpenSession={cashSetting.requireOpenSession}
          showExpectedCash={cashSetting.showExpectedCashToCashier}
        />
      </div>
    </section>
  );
}
