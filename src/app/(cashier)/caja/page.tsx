import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { CashRegister } from "./cash-register";
import { getOfflineCashCatalogAction, getSuggestedCashProductsAction } from "./actions";
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
    offlineCatalog,
    paymentMethods,
    creditPlans,
    printSetting,
    cashSetting,
    fiscalSetting,
    mercadoPagoAccounts
  ] = await Promise.all([
    getOpenCashSessionSnapshot(user.businessId),
    getSuggestedCashProductsAction(),
    getOfflineCashCatalogAction(),
    getEnabledPaymentMethodSettings(user.businessId),
    getActiveCreditInstallmentPlans(),
    getPrintSetting(user.businessId),
    getCashRegisterSetting(user.businessId),
    getFiscalSettingOrDefault(user.businessId),
    getActiveMercadoPagoAccountViews(user.businessId)
  ]);

  return (
    <section className="cash-page flex min-h-0 flex-col gap-3 overflow-hidden">
      {cashSession || !cashSetting.requireOpenSession ? (
        <CashRegister
          initialSuggestedProducts={suggestedProducts}
          offlineCatalog={offlineCatalog}
          offlineContext={
            cashSession
              ? {
                  businessId: user.businessId,
                  userId: user.id,
                  cashSessionId: cashSession.id
                }
              : null
          }
          paymentMethods={paymentMethods}
          creditPlans={creditPlans}
          printSetting={printSetting}
          fiscalSetting={fiscalSetting}
          mercadoPagoAccounts={mercadoPagoAccounts}
          canAccessFiscalAdmin={user?.role === Role.ADMIN}
          allowNegativeStock={cashSetting.allowNegativeStock}
        />
      ) : null}
      <div className="cash-session-wrap shrink-0">
        <CashSessionPanel
          cashSession={cashSession}
          requireOpenSession={cashSetting.requireOpenSession}
          showExpectedCash={cashSetting.showExpectedCashToCashier}
          offlineContext={
            cashSession
              ? {
                  businessId: user.businessId,
                  userId: user.id
                }
              : null
          }
        />
      </div>
    </section>
  );
}
