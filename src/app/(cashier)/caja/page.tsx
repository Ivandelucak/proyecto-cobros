import { CashRegister } from "./cash-register";
import { getSuggestedCashProductsAction } from "./actions";
import { CashSessionPanel } from "./cash-session-panel";
import { getOpenCashSessionSnapshot } from "@/lib/cash-session";

export default async function CajaPage() {
  const [cashSession, suggestedProducts] = await Promise.all([
    getOpenCashSessionSnapshot(),
    getSuggestedCashProductsAction()
  ]);

  return (
    <section className="space-y-5">
      <CashSessionPanel cashSession={cashSession} />
      {cashSession ? <CashRegister initialSuggestedProducts={suggestedProducts} /> : null}
    </section>
  );
}
