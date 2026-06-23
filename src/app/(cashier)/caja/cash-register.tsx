"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrashIcon } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/ui/print-button";
import { recordTicketPrintAction } from "@/app/(sales)/ventas/print-actions";
import { formatARS } from "@/lib/money";
import type {
  CreditInstallmentPlanView,
  PaymentMethodSettingView
} from "@/lib/payment-settings";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import type { PrintSettingView } from "@/lib/print-settings";
import { buildTicketHref } from "@/lib/return-to";
import { cn } from "@/lib/ui";
import {
  confirmRegisterSaleAction,
  searchCashCustomersAction,
  type CashProductResult,
  type CashCustomerResult,
  searchCashProductsAction
} from "./actions";

type CartItem = CashProductResult & {
  quantity: string;
};

type PaymentMethodValue =
  | "CASH"
  | "DEBIT"
  | "CREDIT"
  | "TRANSFER"
  | "MERCADOPAGO"
  | "CURRENT_ACCOUNT";

type PaymentEntry = {
  id: string;
  method: PaymentMethodValue;
  amount: string;
  receivedAmount?: string;
  installments?: number;
  customerId?: string;
  customerName?: string;
};

type FinalPaymentsResult =
  | { ok: true; payments: PaymentEntry[] }
  | { ok: false; error: string };

type AutomaticPaymentResult =
  | { ok: true; payment: PaymentEntry }
  | { ok: false; error: string };

type SaleSuccess = {
  saleId: string;
  saleNumber: number;
  fiscalStatus?: string;
  requiresFiscalInvoice?: boolean;
};

type Message = {
  text: string;
  tone: "ok" | "error";
};

type CashRegisterProps = {
  initialSuggestedProducts: CashProductResult[];
  paymentMethods: PaymentMethodSettingView[];
  creditPlans: CreditInstallmentPlanView[];
  printSetting: PrintSettingView;
  fiscalSetting: FiscalSettingView;
  canAccessFiscalAdmin: boolean;
  allowNegativeStock: boolean;
};

const fallbackPaymentLabels: Record<PaymentMethodValue, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

const AUTO_PAYMENT_AMOUNT = "__AUTO_PENDING__";
const decimalUnits = new Set(["KG", "GR", "LITER", "METER"]);
const fiscalStatusLabels: Record<string, string> = {
  NOT_REQUESTED: "Ticket interno",
  PENDING: "Pendiente de facturacion",
  READY_TO_ISSUE: "Factura preparada",
  ISSUED: "Emitida fiscalmente",
  FAILED: "Facturacion fallida",
  CANCELLED_BEFORE_ISSUE: "Anulada antes de emitir",
  CREDIT_NOTE_REQUIRED: "Requiere nota de credito",
  CANCELLED_BY_CREDIT_NOTE: "Anulada con nota de credito"
};

export function CashRegister({
  initialSuggestedProducts,
  paymentMethods,
  creditPlans,
  printSetting,
  fiscalSetting,
  canAccessFiscalAdmin,
  allowNegativeStock
}: CashRegisterProps) {
  const defaultPaymentMethod =
    (paymentMethods[0]?.method as PaymentMethodValue | undefined) ?? "CASH";
  const defaultInstallments = creditPlans[0]?.installments ?? 1;
  const paymentLabels = useMemo(
    () =>
      paymentMethods.reduce(
        (labels, method) => ({
          ...labels,
          [method.method]: method.label
        }),
        { ...fallbackPaymentLabels }
      ),
    [paymentMethods]
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashProductResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [suggestedProducts, setSuggestedProducts] = useState(initialSuggestedProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>(defaultPaymentMethod);
  const [installments, setInstallments] = useState(defaultInstallments);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CashCustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CashCustomerResult | null>(null);
  const [pendingFiscalPayments, setPendingFiscalPayments] = useState<PaymentEntry[] | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<SaleSuccess | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.salePrice) * safeNumber(item.quantity),
        0
      ),
    [cart]
  );
  const creditPayment = payments.find((payment) => payment.method === "CREDIT");
  const activeCreditInstallments =
    creditPayment?.installments ?? (paymentMethod === "CREDIT" ? installments : null);
  const selectedCreditOption =
    activeCreditInstallments === null
      ? null
      : creditPlans.find((option) => option.installments === activeCreditInstallments) ??
        creditPlans[0] ??
        null;
  const effectiveInstallments = selectedCreditOption?.installments ?? installments;
  const surchargeRate = safeNumber(selectedCreditOption?.surchargeRate ?? 0);
  const surchargeAmount =
    activeCreditInstallments === null ? 0 : roundMoney((subtotal * surchargeRate) / 100);
  const total = roundMoney(subtotal + surchargeAmount);
  const totalPaid = roundMoney(
    payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0)
  );
  const balance = roundMoney(total - totalPaid);
  const remaining = Math.max(balance, 0);
  const overpaid = Math.max(-balance, 0);
  const paymentsMatch = cart.length > 0 && Math.abs(balance) < 0.01;
  const hasInvalidCart = cart.some((item) =>
    !isValidQuantity(item.quantity, item, allowNegativeStock)
  );
  const canFinish =
    cart.length > 0 && !hasInvalidCart && !isPending && !pendingFiscalPayments;
  const currentReceived = safeNumber(cashReceived);
  const currentAmount =
    paymentMethod === "CASH"
      ? roundMoney(Math.min(currentReceived, remaining))
      : safeNumber(paymentAmount || remaining);
  const currentChange =
    paymentMethod === "CASH" ? Math.max(roundMoney(currentReceived - currentAmount), 0) : 0;
  const displayedPaymentAmount =
    paymentAmount === AUTO_PAYMENT_AMOUNT
      ? remaining > 0
        ? String(remaining)
        : ""
      : paymentAmount;
  const quickCashAmounts = buildQuickCashAmounts(remaining);
  const compactProducts = true;
  const paymentsDisabled = cart.length === 0;
  const projectedPaymentMethods = useMemo(
    () => buildProjectedPaymentMethods(payments, paymentMethod, remaining),
    [payments, paymentMethod, remaining]
  );
  const fiscalMode = getFiscalModeForMethods(fiscalSetting, projectedPaymentMethods);
  const willAutoFiscal = fiscalSetting.enabled && fiscalMode === "AUTO";

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchCashProductsAction(search);
        if (cancelled) {
          return;
        }

        setResults(result.products);
        setSelectedResultIndex(0);
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, startTransition]);

  useEffect(() => {
    const search = customerQuery.trim();
    if (paymentMethod !== "CURRENT_ACCOUNT" || search.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const customers = await searchCashCustomersAction(search);
        if (!cancelled) {
          setCustomerResults(customers);
        }
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerQuery, paymentMethod, startTransition]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSaleSuccess(null);

    if (value.trim().length < 2) {
      setResults([]);
      setSelectedResultIndex(0);
    }
  }

  function handleSearchSubmit() {
    const selectedProduct = results[selectedResultIndex];
    if (selectedProduct) {
      addProduct(selectedProduct);
      return;
    }

    const search = query.trim();
    if (!search) {
      return;
    }

    startTransition(async () => {
      const result = await searchCashProductsAction(search);
      const exactProduct = result.exactProductId
        ? result.products.find((product) => product.id === result.exactProductId)
        : null;

      if (exactProduct) {
        addProduct(exactProduct);
        return;
      }

      setResults(result.products);
      setSelectedResultIndex(0);

      if (result.products.length === 0) {
        showMessage("No se encontraron productos.", "error");
      }
    });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setSelectedResultIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setSelectedResultIndex((current) => (current - 1 + results.length) % results.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchSubmit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (pendingFiscalPayments) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingFiscalPayments(null);
      }
      return;
    }

    if (event.key === "F1") {
      event.preventDefault();
      inputRef.current?.focus();
      return;
    }

    if (event.key === "F4") {
      event.preventDefault();
      finishSale();
      return;
    }

    if (event.key === "Escape" && query.trim().length === 0 && results.length === 0) {
      event.preventDefault();
      cancelSale();
    }
  }

  function addProduct(product: CashProductResult) {
    setSaleSuccess(null);
    setMessage(null);

    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      const nextQuantity = increaseQuantity(existing.quantity, product);
      if (!allowNegativeStock && safeNumber(nextQuantity) > safeNumber(product.stock)) {
        showMessage(`Stock insuficiente para ${product.name}.`, "error");
        return;
      }

      setCart((currentCart) =>
        currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQuantity } : item
        )
      );
    } else {
      setCart((currentCart) => [...currentCart, { ...product, quantity: "1" }]);
    }

    clearSearch();
    inputRef.current?.focus();
  }

  function updateQuantity(productId: string, rawQuantity: string) {
    setSaleSuccess(null);
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? { ...item, quantity: sanitizeQuantity(rawQuantity, item) }
          : item
      )
    );
  }

  function adjustQuantity(item: CartItem, direction: 1 | -1) {
    const step = allowsDecimal(item) ? 0.1 : 1;
    const nextQuantity = roundQuantity(safeNumber(item.quantity) + step * direction);

    if (nextQuantity <= 0) {
      removeItem(item.id);
      return;
    }

    if (!allowNegativeStock && nextQuantity > safeNumber(item.stock)) {
      showMessage(`Stock insuficiente para ${item.name}.`, "error");
      return;
    }

    updateQuantity(item.id, String(nextQuantity));
  }

  function removeItem(productId: string) {
    setSaleSuccess(null);
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  }

  function addPayment() {
    setSaleSuccess(null);

    if (cart.length === 0) {
      showMessage("Agrega productos antes de cargar pagos.", "error");
      return;
    }

    if (hasInvalidCart) {
      showMessage("Revisa las cantidades del carrito.", "error");
      return;
    }

    if (remaining <= 0) {
      showMessage("El total ya esta cubierto.", "error");
      return;
    }

    if (paymentMethod === "CREDIT" && creditPayment) {
      showMessage("Solo se permite un pago con credito por venta.", "error");
      return;
    }

    if (paymentMethod === "CURRENT_ACCOUNT" && !selectedCustomer) {
      showMessage("Selecciona un cliente para cargar a cuenta corriente.", "error");
      return;
    }

    const option = paymentMethod === "CREDIT" ? selectedCreditOption : null;
    if (paymentMethod === "CREDIT" && !option) {
      showMessage("Cantidad de cuotas invalida.", "error");
      return;
    }

    if (paymentMethod === "CASH") {
      const receivedAmount = roundMoney(safeNumber(cashReceived));
      if (receivedAmount <= 0) {
        showMessage("Ingresa el efectivo recibido.", "error");
        return;
      }

      const amount = roundMoney(Math.min(receivedAmount, remaining));
      if (amount <= 0) {
        showMessage("No hay saldo para aplicar.", "error");
        return;
      }

      setPayments((currentPayments) => [
        ...currentPayments,
        {
          id: createPaymentId(),
          method: paymentMethod,
          amount: String(amount),
          receivedAmount: String(receivedAmount)
        }
      ]);
      setCashReceived("");
      setPaymentAmount("");
      setMessage(null);
      return;
    }

    const amount = roundMoney(safeNumber(displayedPaymentAmount || remaining));
    if (amount <= 0) {
      showMessage("Ingresa un importe para el pago.", "error");
      return;
    }

    if (amount > remaining) {
      showMessage("El importe supera el saldo pendiente.", "error");
      return;
    }

    setPayments((currentPayments) => [
      ...currentPayments,
      {
        id: createPaymentId(),
        method: paymentMethod,
        amount: String(amount),
        installments: paymentMethod === "CREDIT" ? option?.installments : undefined,
        customerId:
          paymentMethod === "CURRENT_ACCOUNT" ? selectedCustomer?.id : undefined,
        customerName:
          paymentMethod === "CURRENT_ACCOUNT" ? selectedCustomer?.name : undefined
      }
    ]);
    setPaymentAmount(shouldAutofillPaymentAmount(paymentMethod) ? AUTO_PAYMENT_AMOUNT : "");
    setCashReceived("");
    setCustomerQuery("");
    setCustomerResults([]);
    setMessage(null);
  }

  function removePayment(paymentId: string) {
    setPayments((currentPayments) =>
      currentPayments.filter((payment) => payment.id !== paymentId)
    );
  }

  function cancelSale() {
    setCart([]);
    setPayments([]);
    setPaymentAmount("");
    setCashReceived("");
    setInstallments(defaultInstallments);
    setPaymentMethod(defaultPaymentMethod);
    setPendingFiscalPayments(null);
    setMessage(null);
    setSaleSuccess(null);
    clearSearch();
    inputRef.current?.focus();
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setSelectedResultIndex(0);
  }

  function finishSale() {
    if (cart.length === 0) {
      showMessage("Agrega productos antes de finalizar.", "error");
      return;
    }

    if (hasInvalidCart) {
      showMessage("Revisa las cantidades del carrito.", "error");
      return;
    }

    if (overpaid > 0) {
      showMessage("Los pagos superan el total de la venta.", "error");
      return;
    }

    const finalPayments = buildFinalPayments();
    if (!finalPayments.ok) {
      showMessage(finalPayments.error, "error");
      return;
    }

    const finalFiscalMode = getFiscalModeForMethods(
      fiscalSetting,
      finalPayments.payments.map((payment) => payment.method)
    );

    if (
      fiscalSetting.enabled &&
      finalFiscalMode === "ASK" &&
      canAskFiscalDecisionForMethods(finalPayments.payments.map((payment) => payment.method))
    ) {
      setMessage(null);
      setPendingFiscalPayments(finalPayments.payments);
      return;
    }

    submitSale(finalPayments.payments, null);
  }

  function submitSale(
    finalPayments: PaymentEntry[],
    requestedFiscalInvoice: boolean | null
  ) {
    setMessage(null);
    setPendingFiscalPayments(null);
    startTransition(async () => {
      const accountPayment = finalPayments.find(
        (payment) => payment.method === "CURRENT_ACCOUNT"
      );
      const result = await confirmRegisterSaleAction({
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity
        })),
        payments: finalPayments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          receivedAmount: payment.receivedAmount,
          installments: payment.method === "CREDIT" ? payment.installments : undefined
        })),
        customerId: accountPayment?.customerId ?? null,
        fiscalInvoiceRequested: requestedFiscalInvoice
      });

      if (!result.ok) {
        showMessage(result.error ?? "No se pudo confirmar la venta.", "error");
        return;
      }

      const confirmedSale = {
        saleId: result.saleId ?? "",
        saleNumber: result.saleNumber ?? 0,
        fiscalStatus: result.fiscalStatus,
        requiresFiscalInvoice: result.requiresFiscalInvoice
      };
      setSaleSuccess({
        saleId: confirmedSale.saleId,
        saleNumber: confirmedSale.saleNumber,
        fiscalStatus: confirmedSale.fiscalStatus,
        requiresFiscalInvoice: confirmedSale.requiresFiscalInvoice
      });
      setCart([]);
      setPayments([]);
      setPaymentAmount("");
      setCashReceived("");
      setInstallments(defaultInstallments);
      setPaymentMethod(defaultPaymentMethod);
      setCustomerQuery("");
      setCustomerResults([]);
      setSelectedCustomer(null);
      clearSearch();
      if (result.suggestedProducts) {
        setSuggestedProducts(result.suggestedProducts);
      }
      inputRef.current?.focus();
      void maybeAutoPrintTicket(confirmedSale.saleId);
    });
  }

  function showMessage(text: string, tone: "ok" | "error") {
    setMessage({ text, tone });
  }

  async function maybeAutoPrintTicket(saleId: string) {
    if (!printSetting.autoPrintTicket || !saleId) {
      return;
    }

    if (!window.posElectron?.isElectron) {
      const printHref = buildTicketHref(saleId, "/caja", { print: true });
      const ticketWindow = window.open(
        printHref,
        "_blank",
        "popup,width=420,height=720"
      );

      if (!ticketWindow) {
        const error =
          "El navegador bloqueo la ventana de impresion. Usa Imprimir ticket.";
        showMessage(`Venta confirmada, pero ${error}`, "error");
        await recordTicketPrintAction({ saleId, ok: false, error });
        return;
      }

      showMessage("Venta confirmada e impresion abierta.", "ok");
      await recordTicketPrintAction({ saleId, ok: true });
      return;
    }

    if (printSetting.silentPrint && !printSetting.printerName) {
      const error = "La impresion silenciosa requiere una impresora seleccionada.";
      showMessage(`Venta confirmada, pero ${error}`, "error");
      await recordTicketPrintAction({ saleId, ok: false, error });
      return;
    }

    const result = await window.posElectron.printTicket(saleId, {
      printerName: printSetting.printerName,
      paperSize: printSetting.paperSize,
      silent: printSetting.silentPrint,
      copies: printSetting.copies,
      marginMm: printSetting.marginMm
    });

    if (result.ok) {
      showMessage("Venta confirmada e impresion enviada.", "ok");
      await recordTicketPrintAction({ saleId, ok: true });
      return;
    }

    const error = result.error || "No se pudo imprimir el ticket";
    showMessage(`Venta confirmada, pero ${error}`, "error");
    await recordTicketPrintAction({ saleId, ok: false, error });
  }

  function fillPendingAmount() {
    const value = String(roundMoney(remaining));
    if (paymentMethod === "CASH") {
      setCashReceived(value);
    } else {
      setPaymentAmount(shouldAutofillPaymentAmount(paymentMethod) ? AUTO_PAYMENT_AMOUNT : value);
    }
    setMessage(null);
  }

  function buildFinalPayments(): FinalPaymentsResult {
    if (paymentsMatch) {
      return { ok: true, payments };
    }

    if (remaining <= 0) {
      return { ok: false, error: "Los pagos no coinciden con el total de la venta." };
    }

    const automaticPayment = buildAutomaticPayment();
    if (!automaticPayment.ok) {
      return automaticPayment;
    }

    return {
      ok: true,
      payments: [...payments, automaticPayment.payment]
    };
  }

  function buildAutomaticPayment(): AutomaticPaymentResult {
    const amount = roundMoney(remaining);

    if (paymentMethod === "CASH") {
      const receivedAmount = roundMoney(safeNumber(cashReceived));
      if (receivedAmount <= 0) {
        return { ok: false, error: "Ingresa el efectivo recibido." };
      }
      if (receivedAmount < amount) {
        return {
          ok: false,
          error: `El efectivo recibido no cubre el pendiente de ${formatARS(amount)}.`
        };
      }

      return {
        ok: true,
        payment: {
          id: createPaymentId(),
          method: "CASH",
          amount: String(amount),
          receivedAmount: String(receivedAmount)
        }
      };
    }

    if (paymentMethod === "CREDIT") {
      if (creditPayment) {
        return { ok: false, error: "Solo se permite un pago con credito por venta." };
      }
      if (!selectedCreditOption) {
        return { ok: false, error: "Cantidad de cuotas invalida." };
      }

      return {
        ok: true,
        payment: {
          id: createPaymentId(),
          method: "CREDIT",
          amount: String(amount),
          installments: selectedCreditOption.installments
        }
      };
    }

    if (paymentMethod === "CURRENT_ACCOUNT") {
      if (!selectedCustomer) {
        return {
          ok: false,
          error: "Selecciona un cliente para cargar a cuenta corriente."
        };
      }

      return {
        ok: true,
        payment: {
          id: createPaymentId(),
          method: "CURRENT_ACCOUNT",
          amount: String(amount),
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name
        }
      };
    }

    return {
      ok: true,
      payment: {
        id: createPaymentId(),
        method: paymentMethod,
        amount: String(amount)
      }
    };
  }

  return (
    <section
      className="grid min-h-[calc(100vh-12rem)] gap-3 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:gap-4"
      onKeyDown={handlePanelKeyDown}
    >
      <div className="min-w-0 space-y-3 2xl:space-y-4">
        <Card className="border-slate-300 bg-gradient-to-b from-white to-slate-50/50 p-3 shadow-lg shadow-slate-300/30 ring-1 ring-white/70 dark:bg-none dark:shadow-none dark:ring-0 2xl:p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearchSubmit();
            }}
          >
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Escanear codigo o buscar producto"
              className="h-12 border-slate-400/80 bg-white text-base shadow-inner shadow-slate-100/70 focus:border-brand-600 focus:ring-brand-100 dark:shadow-none"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || query.trim().length === 0}
              className="shrink-0"
            >
              Buscar
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Badge>F1 Buscar</Badge>
            <Badge>Enter Agregar</Badge>
            <Badge>F4 Cobrar</Badge>
            <Badge>Esc Limpiar</Badge>
          </div>

          {results.length > 0 ? (
            <ProductGrid
              title="Resultados"
              products={results}
              compact={compactProducts}
              selectedIndex={selectedResultIndex}
              onAddProduct={addProduct}
            />
          ) : (
            <ProductGrid
              title="Productos rapidos"
              products={suggestedProducts}
              compact={compactProducts}
              onAddProduct={addProduct}
            />
          )}
        </Card>

        <Card className="overflow-hidden border-slate-300 shadow-lg shadow-slate-300/25 dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b-2 border-slate-300 bg-slate-200 text-xs uppercase tracking-wide text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Cantidad</th>
                  <th className="px-4 py-3 font-semibold">Precio</th>
                  <th className="px-4 py-3 font-semibold">Subtotal</th>
                  <th className="px-4 py-3 text-right font-semibold">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-800">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                      Agrega productos para iniciar la venta.
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => {
                    const quantity = safeNumber(item.quantity);
                    const subtotalItem = Number(item.salePrice) * quantity;
                    const invalid = !isValidQuantity(
                      item.quantity,
                      item,
                      allowNegativeStock
                    );
                    const stockExceeded =
                      !allowNegativeStock && quantity > safeNumber(item.stock);

                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800/60"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-gray-950 dark:text-gray-50">
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.categoryName} - {formatStock(item.stock, item.unitType)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => adjustQuantity(item, -1)}
                            >
                              -
                            </Button>
                            <Input
                              value={item.quantity}
                              inputMode={allowsDecimal(item) ? "decimal" : "numeric"}
                              onChange={(event) =>
                                updateQuantity(item.id, event.target.value)
                              }
                              className="h-9 w-24 text-center"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => adjustQuantity(item, 1)}
                            >
                              +
                            </Button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {unitLabel(item.unitType)}
                            </span>
                          </div>
                          {invalid ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                              {stockExceeded
                                ? "Supera el stock disponible."
                                : "Cantidad invalida."}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-gray-200">{formatARS(item.salePrice)}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-gray-50">
                          {formatARS(subtotalItem)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-600 hover:shadow dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none dark:hover:border-red-900/50 dark:hover:bg-red-950/35 dark:hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                            aria-label="Quitar producto"
                            title="Quitar producto"
                            onClick={() => removeItem(item.id)}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start 2xl:space-y-4">
        <Card className="border-t-4 border-t-brand-500 border-slate-300/90 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-xl shadow-slate-300/40 ring-1 ring-white/80 dark:bg-none dark:shadow-none dark:ring-0 2xl:p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
              Total final
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-950 dark:text-gray-50 2xl:text-5xl">
              {formatARS(total)}
            </p>
            {surchargeAmount > 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Subtotal {formatARS(subtotal)} - Recargo {formatARS(surchargeAmount)}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <SummaryValue label="Pagado" value={formatARS(totalPaid)} tone="ok" />
            <SummaryValue
              label={overpaid > 0 ? "Excedente" : "Pendiente"}
              value={formatARS(overpaid > 0 ? overpaid : remaining)}
              tone={overpaid > 0 ? "error" : remaining === 0 ? "ok" : "default"}
            />
          </div>

          <div
            className={cn(
              "mt-4 rounded-lg border px-3 py-2.5 text-sm font-semibold text-center transition-colors duration-150",
              paymentsDisabled
                ? "border-slate-300 bg-slate-50 text-slate-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400"
                : remaining === 0 && overpaid === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : overpaid > 0
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"
            )}
          >
            {paymentsDisabled
              ? "Agrega productos para cargar pagos."
              : overpaid > 0
                ? `Excedente ${formatARS(overpaid)}`
                : remaining === 0
                  ? "Pago completo"
                  : `Pendiente ${formatARS(remaining)}`}
          </div>

          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-300">
            {paymentsDisabled
              ? "Agrega productos para elegir el medio de pago."
              : payments.length === 0
                ? `Se cobrara el total con ${paymentLabels[paymentMethod]}.`
                : paymentsMatch
                  ? "Pago completo con los pagos cargados."
                  : `Pagos parciales cargados. Pendiente ${formatARS(remaining)}.`}
          </p>

          <div className={cn("mt-4 space-y-4", paymentsDisabled && "opacity-60")}>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Medio de pago
              </span>
              <Select
                value={paymentMethod}
                disabled={paymentsDisabled}
                onChange={(event) => {
                  const nextMethod = event.target.value as PaymentMethodValue;
                  setPaymentMethod(nextMethod);
                  setInstallments(defaultInstallments);
                  setPaymentAmount(
                    shouldAutofillPaymentAmount(nextMethod)
                      ? AUTO_PAYMENT_AMOUNT
                      : ""
                  );
                  if (nextMethod !== "CURRENT_ACCOUNT") {
                    setCustomerResults([]);
                  }
                }}
              >
                {paymentMethods.map((method) => (
                  <option key={method.method} value={method.method}>
                    {method.label}
                  </option>
                ))}
              </Select>
            </label>

            {paymentMethod === "CREDIT" ? (
              <div className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Cuotas
                  </span>
                  <Select
                    value={effectiveInstallments}
                    disabled={paymentsDisabled || Boolean(creditPayment) || creditPlans.length === 0}
                    onChange={(event) => setInstallments(Number(event.target.value))}
                  >
                    {creditPlans.map((option) => (
                      <option key={option.installments} value={option.installments}>
                        {option.installments} cuota{option.installments > 1 ? "s" : ""} -{" "}
                        {option.surchargeRate}% recargo
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <p>Recargo estimado: {formatARS(surchargeAmount)}</p>
                  <p>
                    Valor por cuota estimado:{" "}
                    {formatARS(
                      effectiveInstallments > 0 ? roundMoney(total / effectiveInstallments) : total
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {paymentMethod === "CURRENT_ACCOUNT" ? (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Esta venta se cargara a cuenta corriente.
                </p>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Cliente
                  </span>
                  <Input
                    value={customerQuery}
                    disabled={paymentsDisabled}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                      setSelectedCustomer(null);
                      if (event.target.value.trim().length < 2) {
                        setCustomerResults([]);
                      }
                    }}
                    placeholder="Buscar nombre, documento o telefono"
                  />
                </label>
                {customerResults.length > 0 ? (
                  <div className="space-y-2">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery(customer.name);
                          setCustomerResults([]);
                        }}
                      >
                        <span className="block font-medium text-gray-950 dark:text-gray-50">
                          {customer.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {[customer.document, customer.phone].filter(Boolean).join(" - ") ||
                            "Sin documento"}
                          {" · "}Saldo {formatARS(customer.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedCustomer ? (
                  <div className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900/60 dark:bg-neutral-950">
                    <p className="font-medium text-gray-950 dark:text-gray-50">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Saldo actual {formatARS(selectedCustomer.balance)}
                    </p>
                  </div>
                ) : null}
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Importe a fiar
                  </span>
                  <Input
                    value={paymentAmount}
                    inputMode="decimal"
                    disabled={paymentsDisabled}
                    onChange={(event) =>
                      setPaymentAmount(sanitizeMoneyInput(event.target.value))
                    }
                    placeholder={formatARS(remaining)}
                    className="h-12 text-lg font-semibold"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-neutral-950 dark:text-amber-200 dark:hover:bg-amber-950/30"
                  disabled={paymentsDisabled || remaining <= 0}
                  onClick={fillPendingAmount}
                >
                  Completar con pendiente
                </Button>
              </div>
            ) : paymentMethod === "CASH" ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Monto recibido
                  </span>
                  <Input
                    value={cashReceived}
                    inputMode="decimal"
                    disabled={paymentsDisabled}
                    onChange={(event) =>
                      setCashReceived(sanitizeMoneyInput(event.target.value))
                    }
                    placeholder="0"
                    className="h-12 text-lg font-semibold"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount, index) => (
                    <Button
                      key={`${amount}-${index}`}
                      type="button"
                      size="sm"
                      className="border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                      disabled={paymentsDisabled}
                      onClick={() => setCashReceived(String(amount))}
                    >
                      {index === 0 ? "Exacto " : ""}
                      {formatARS(amount)}
                    </Button>
                  ))}
                </div>
                <PaymentPreview
                  label="Aplicado"
                  value={formatARS(currentAmount)}
                  hint={
                    currentChange > 0
                      ? `Vuelto ${formatARS(currentChange)}`
                      : remaining > 0 && currentAmount >= remaining
                        ? "Pago exacto"
                      : remaining > 0
                        ? `Faltan ${formatARS(Math.max(remaining - currentAmount, 0))}`
                        : "Sin saldo pendiente"
                  }
                />
              </>
            ) : (
              <div className="space-y-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Importe
                  </span>
                  <Input
                    value={displayedPaymentAmount}
                    inputMode="decimal"
                    disabled={paymentsDisabled}
                    onChange={(event) =>
                      setPaymentAmount(sanitizeMoneyInput(event.target.value))
                    }
                    placeholder={formatARS(remaining)}
                    className="h-12 text-lg font-semibold"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                  disabled={paymentsDisabled || remaining <= 0}
                  onClick={fillPendingAmount}
                >
                  Completar con pendiente
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              disabled={
                isPending ||
                paymentsDisabled ||
                (paymentMethod === "CREDIT" && creditPlans.length === 0)
              }
              onClick={addPayment}
            >
              Agregar pago parcial
            </Button>
          </div>

          {fiscalSetting.enabled && cart.length > 0 && fiscalMode !== "ASK" ? (
            <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
              <p className="font-semibold text-gray-950 dark:text-gray-50">
                Facturacion
              </p>
              <p className="mt-1 text-gray-600 dark:text-gray-300">
                {willAutoFiscal
                  ? "Esta venta quedara pendiente de facturacion."
                  : "Esta venta quedara como ticket interno."}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                No se emite comprobante real en ARCA en esta etapa.
              </p>
            </div>
          ) : null}

          {payments.length > 0 ? (
            <div className="mt-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                Pagos cargados
              </h2>
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none"
                >
                  <div>
                    <p className="font-medium text-gray-950 dark:text-gray-50">
                      {paymentLabels[payment.method]} {formatARS(payment.amount)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {payment.method === "CASH" && payment.receivedAmount
                        ? `Recibido ${formatARS(payment.receivedAmount)}`
                        : payment.method === "CREDIT" && payment.installments
                          ? `${payment.installments} cuota${
                              payment.installments > 1 ? "s" : ""
                            }`
                          : payment.method === "CURRENT_ACCOUNT" && payment.customerName
                            ? payment.customerName
                          : "Pago aplicado"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar pago ${paymentLabels[payment.method]}`}
                    title="Quitar pago"
                    onClick={() => removePayment(payment.id)}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {saleSuccess ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
              <p className="font-medium">Venta #{saleSuccess.saleNumber} confirmada.</p>
              {saleSuccess.fiscalStatus ? (
                <p className="mt-1">
                  Estado fiscal:{" "}
                  {fiscalStatusLabels[saleSuccess.fiscalStatus] ??
                    saleSuccess.fiscalStatus}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={cancelSale}>
                  Nueva venta
                </Button>
                <LinkButton size="sm" href={buildTicketHref(saleSuccess.saleId, "/caja")}>
                  Ver ticket
                </LinkButton>
                <PrintButton
                  saleId={saleSuccess.saleId}
                  setting={printSetting}
                  printHref={buildTicketHref(saleSuccess.saleId, "/caja", {
                    print: true
                  })}
                />
                <LinkButton size="sm" href={`/ventas/${saleSuccess.saleId}`}>
                  Ver venta
                </LinkButton>
                {canAccessFiscalAdmin && isFiscalQueueStatus(saleSuccess.fiscalStatus) ? (
                  <LinkButton size="sm" href="/facturacion">
                    Ver facturacion
                  </LinkButton>
                ) : null}
              </div>
            </div>
          ) : null}

          {message ? (
            <p
              className={
                message.tone === "ok"
                  ? "mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
              }
            >
              {message.text}
            </p>
          ) : null}

          <div className="mt-5 grid gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={!canFinish}
              className="h-14 text-base font-bold tracking-wide w-full shadow-md shadow-brand-600/10 hover:shadow-brand-600/20 active:scale-[0.99] transition-all duration-200 disabled:shadow-none"
              onClick={finishSale}
            >
              {isPending ? "Confirmando..." : "Finalizar venta"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-slate-200 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              onClick={cancelSale}
            >
              Cancelar venta
            </Button>
          </div>
        </Card>
      </aside>
      {pendingFiscalPayments ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fiscal-sale-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <h2
              id="fiscal-sale-dialog-title"
              className="text-lg font-semibold text-gray-950 dark:text-gray-50"
            >
              Facturacion de la venta
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {getFiscalModalDescription(
                pendingFiscalPayments.map((payment) => payment.method)
              )}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => submitSale(pendingFiscalPayments, false)}
              >
                Solo ticket interno
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isPending}
                onClick={() => submitSale(pendingFiscalPayments, true)}
              >
                Enviar a facturacion
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="sm:col-span-2"
                disabled={isPending}
                onClick={() => setPendingFiscalPayments(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProductGrid({
  title,
  products,
  compact,
  selectedIndex,
  onAddProduct
}: {
  title: string;
  products: CashProductResult[];
  compact: boolean;
  selectedIndex?: number;
  onAddProduct: (product: CashProductResult) => void;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "mt-3" : "mt-5"}>
      <h2
        className={cn(
          "font-bold text-slate-800 dark:text-gray-50",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          compact ? "mt-2 grid gap-2" : "mt-3 grid gap-2",
          compact
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
            : "sm:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {products.map((product, index) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onAddProduct(product)}
            className={cn(
              "group min-w-0 cursor-pointer rounded-lg border border-slate-300 bg-gradient-to-b from-white to-slate-50/80 text-left shadow-sm transition-all duration-200 border-l-4 border-l-slate-300/80 hover:border-brand-400/80 hover:border-l-brand-500 hover:bg-brand-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:scale-[0.99] dark:border-neutral-800 dark:bg-none dark:bg-neutral-950 dark:shadow-none dark:hover:bg-neutral-900 dark:border-l-neutral-700 dark:hover:border-l-brand-500",
              compact ? "p-2" : "p-3",
              selectedIndex === index &&
                "border-brand-500 bg-brand-50/50 border-l-brand-600 ring-2 ring-brand-100 dark:border-brand-400 dark:bg-brand-950/40 dark:ring-brand-900/70"
            )}
          >
            <span
              className={cn(
                "line-clamp-2 font-semibold text-slate-800 transition-colors group-hover:text-brand-700 dark:text-gray-200 dark:group-hover:text-brand-400",
                compact ? "min-h-8 text-xs" : "min-h-10 text-sm"
              )}
            >
              {product.name}
            </span>
            <span className={cn("block truncate font-extrabold text-brand-700 dark:text-brand-400", compact ? "mt-1 text-sm" : "mt-2 text-base")}>
              {formatARS(product.salePrice)}
            </span>
            <span className={cn("mt-1 block truncate text-gray-500 dark:text-gray-400", compact ? "text-[11px]" : "text-xs")}>
              {product.categoryName} - {formatStock(product.stock, product.unitType)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryValue({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-sm transition-colors duration-200",
        tone === "default" && "border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-neutral-950",
        tone === "ok" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-neutral-950",
        tone === "error" && "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-neutral-950"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base font-semibold 2xl:text-lg",
          tone === "default" && "text-amber-800 dark:text-amber-200",
          tone === "ok" && "text-emerald-800 dark:text-emerald-300",
          tone === "error" && "text-red-800 dark:text-red-300"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PaymentPreview({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-gray-50">
        {value}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

type QuantityConfig = Pick<CashProductResult, "allowsDecimalQuantity" | "unitType">;

function allowsDecimal(item: QuantityConfig) {
  return item.allowsDecimalQuantity || decimalUnits.has(item.unitType);
}

function isValidQuantity(quantity: string, item: CartItem, allowNegativeStock: boolean) {
  const value = safeNumber(quantity);
  if (value <= 0 || (!allowNegativeStock && value > safeNumber(item.stock))) {
    return false;
  }

  return allowsDecimal(item) || Number.isInteger(value);
}

function increaseQuantity(quantity: string, item: QuantityConfig) {
  return String(roundQuantity(safeNumber(quantity) + (allowsDecimal(item) ? 0.1 : 1)));
}

function sanitizeQuantity(value: string, item: CartItem) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const decimal = decimalParts.join("");

  if (!allowsDecimal(item)) {
    return whole;
  }

  return decimalParts.length > 0 ? `${whole}.${decimal.slice(0, 3)}` : whole;
}

function sanitizeMoneyInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const decimal = decimalParts.join("");

  return decimalParts.length > 0 ? `${whole}.${decimal.slice(0, 2)}` : whole;
}

function buildQuickCashAmounts(total: number) {
  if (total <= 0) {
    return [2000, 5000, 10000];
  }

  const values = [
    roundMoney(total),
    Math.ceil(total / 1000) * 1000,
    2000,
    5000,
    10000,
    20000
  ]
    .filter((amount) => amount >= total)
    .sort((a, b) => a - b);

  return [...new Set(values)].slice(0, 5);
}

function unitLabel(unitType: string) {
  const labels: Record<string, string> = {
    UNIT: "u.",
    KG: "kg",
    GR: "gr",
    LITER: "l",
    METER: "m",
    PACK: "pack",
    BOX: "caja",
    OTHER: "otro"
  };

  return labels[unitType] ?? unitType;
}

function formatStock(value: string, unitType: string) {
  const stock = safeNumber(value);
  const decimals = decimalUnits.has(unitType) && !Number.isInteger(stock) ? 3 : 0;

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(stock)} ${unitLabel(unitType)}`;
}

function safeNumber(value: string | number) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function shouldAutofillPaymentAmount(method: PaymentMethodValue) {
  return ["MERCADOPAGO", "TRANSFER", "DEBIT", "CREDIT"].includes(method);
}

function buildProjectedPaymentMethods(
  payments: PaymentEntry[],
  paymentMethod: PaymentMethodValue,
  remaining: number
) {
  const methods = payments.map((payment) => payment.method);
  if (remaining > 0 && !methods.includes(paymentMethod)) {
    methods.push(paymentMethod);
  }
  return methods;
}

function getFiscalModeForMethods(
  setting: FiscalSettingView,
  methods: PaymentMethodValue[]
) {
  if (!setting.enabled) {
    return "NEVER";
  }

  const hasElectronic = methods.some((method) =>
    ["DEBIT", "CREDIT", "TRANSFER", "MERCADOPAGO"].includes(method)
  );
  if (hasElectronic) {
    return setting.electronicPaymentIssueMode;
  }

  if (methods.includes("CURRENT_ACCOUNT")) {
    return setting.currentAccountIssueMode;
  }

  return setting.cashIssueMode;
}

function canAskFiscalDecisionForMethods(methods: PaymentMethodValue[]) {
  const hasElectronic = methods.some((method) =>
    ["DEBIT", "CREDIT", "TRANSFER", "MERCADOPAGO"].includes(method)
  );

  if (hasElectronic) {
    return false;
  }

  return methods.includes("CASH") || methods.includes("CURRENT_ACCOUNT");
}

function getFiscalModalDescription(methods: PaymentMethodValue[]) {
  if (methods.includes("CURRENT_ACCOUNT")) {
    return "Esta venta fue registrada en cuenta corriente. Elegi como queres registrarla fiscalmente.";
  }

  return "Esta venta fue cobrada en efectivo. Elegi como queres registrarla fiscalmente.";
}

function isFiscalQueueStatus(status: string | undefined) {
  return status === "PENDING" || status === "READY_TO_ISSUE";
}

function createPaymentId() {
  return globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
}
