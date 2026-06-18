import { CashRegister } from "./cash-register";
import { getSuggestedCashProductsAction } from "./actions";
import { CashSessionPanel } from "./cash-session-panel";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";
import {
  getActiveCreditInstallmentPlans,
  getEnabledPaymentMethodSettings
} from "@/lib/payment-settings";

export default async function CajaPage() {
  const [cashSession, suggestedProducts, paymentMethods, creditPlans] = await Promise.all([
    getOpenCashSessionSnapshot(),
    getSuggestedCashProductsAction(),
    getEnabledPaymentMethodSettings(),
    getActiveCreditInstallmentPlans()
  ]);

  return (
    <section className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4">
      {cashSession ? (
        <CashRegister
          initialSuggestedProducts={suggestedProducts}
          paymentMethods={paymentMethods}
          creditPlans={creditPlans}
        />
      ) : null}
      <div className="mt-auto">
        <CashSessionPanel cashSession={cashSession} />
      </div>
    </section>
  );
}
