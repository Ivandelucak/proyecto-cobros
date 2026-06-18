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
    <section className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4">
      {cashSession ? <CashRegister initialSuggestedProducts={suggestedProducts} /> : null}
      <div className="mt-auto">
        <CashSessionPanel cashSession={cashSession} />
      </div>
    </section>
  );
}
