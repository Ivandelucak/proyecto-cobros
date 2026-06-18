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
import { formatARS } from "@/lib/money";
import {
  CREDIT_INSTALLMENT_OPTIONS,
  getCreditInstallmentOption
} from "@/lib/payment-options";
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

type SaleSuccess = {
  saleId: string;
  saleNumber: number;
};

type Message = {
  text: string;
  tone: "ok" | "error";
};

type CashRegisterProps = {
  initialSuggestedProducts: CashProductResult[];
};

const paymentLabels: Record<PaymentMethodValue, string> = {
  CASH: "Efectivo",
  DEBIT: "Debito",
  CREDIT: "Credito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "MercadoPago",
  CURRENT_ACCOUNT: "Cuenta corriente"
};

const decimalUnits = new Set(["KG", "GR", "LITER", "METER"]);

export function CashRegister({ initialSuggestedProducts }: CashRegisterProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashProductResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [suggestedProducts, setSuggestedProducts] = useState(initialSuggestedProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("CASH");
  const [installments, setInstallments] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CashCustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CashCustomerResult | null>(null);
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
      : getCreditInstallmentOption(activeCreditInstallments);
  const surchargeRate = selectedCreditOption?.surchargeRate ?? 0;
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
  const hasInvalidCart = cart.some((item) => !isValidQuantity(item.quantity, item));
  const canFinish = cart.length > 0 && !hasInvalidCart && paymentsMatch && !isPending;
  const currentReceived = safeNumber(cashReceived);
  const currentAmount =
    paymentMethod === "CASH"
      ? roundMoney(Math.min(currentReceived, remaining))
      : safeNumber(paymentAmount || remaining);
  const currentChange =
    paymentMethod === "CASH" ? Math.max(roundMoney(currentReceived - currentAmount), 0) : 0;
  const quickCashAmounts = buildQuickCashAmounts(remaining);
  const compactProducts = cart.length > 0;
  const paymentsDisabled = cart.length === 0;

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
      if (safeNumber(nextQuantity) > safeNumber(product.stock)) {
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

    if (nextQuantity > safeNumber(item.stock)) {
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

    const option = paymentMethod === "CREDIT" ? getCreditInstallmentOption(installments) : null;
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

    const amount = roundMoney(safeNumber(paymentAmount || remaining));
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
        installments: paymentMethod === "CREDIT" ? installments : undefined,
        customerId:
          paymentMethod === "CURRENT_ACCOUNT" ? selectedCustomer?.id : undefined,
        customerName:
          paymentMethod === "CURRENT_ACCOUNT" ? selectedCustomer?.name : undefined
      }
    ]);
    setPaymentAmount("");
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
    setInstallments(1);
    setPaymentMethod("CASH");
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
    if (!canFinish) {
      if (hasInvalidCart) {
        showMessage("Revisa las cantidades del carrito.", "error");
      } else if (payments.length === 0 || remaining > 0) {
        showMessage("Completa los pagos antes de finalizar.", "error");
      } else if (overpaid > 0) {
        showMessage("Los pagos superan el total de la venta.", "error");
      }
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const accountPayment = payments.find(
        (payment) => payment.method === "CURRENT_ACCOUNT"
      );
      const result = await confirmRegisterSaleAction({
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity
        })),
        payments: payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          receivedAmount: payment.receivedAmount,
          installments: payment.method === "CREDIT" ? payment.installments : undefined
        })),
        customerId: accountPayment?.customerId ?? null
      });

      if (!result.ok) {
        showMessage(result.error ?? "No se pudo confirmar la venta.", "error");
        return;
      }

      setSaleSuccess({
        saleId: result.saleId ?? "",
        saleNumber: result.saleNumber ?? 0
      });
      setCart([]);
      setPayments([]);
      setPaymentAmount("");
      setCashReceived("");
      setInstallments(1);
      setPaymentMethod("CASH");
      setCustomerQuery("");
      setCustomerResults([]);
      setSelectedCustomer(null);
      clearSearch();
      if (result.suggestedProducts) {
        setSuggestedProducts(result.suggestedProducts);
      }
      inputRef.current?.focus();
    });
  }

  function showMessage(text: string, tone: "ok" | "error") {
    setMessage({ text, tone });
  }

  return (
    <section
      className="grid min-h-[calc(100vh-12rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"
      onKeyDown={handlePanelKeyDown}
    >
      <div className="space-y-4">
        <Card className="p-4">
          <form
            className="flex gap-3"
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
              className="h-12 text-base"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || query.trim().length === 0}
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

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Producto</th>
                  <th className="px-4 py-2.5 font-medium">Cantidad</th>
                  <th className="px-4 py-2.5 font-medium">Precio</th>
                  <th className="px-4 py-2.5 font-medium">Subtotal</th>
                  <th className="px-4 py-2.5 text-right font-medium">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
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
                    const invalid = !isValidQuantity(item.quantity, item);
                    const stockExceeded = quantity > safeNumber(item.stock);

                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/60"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-950 dark:text-gray-50">
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.categoryName} - {formatStock(item.stock, item.unitType)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
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
                        <td className="px-4 py-2.5">{formatARS(item.salePrice)}</td>
                        <td className="px-4 py-2.5 font-medium">
                          {formatARS(subtotalItem)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 border-red-100 px-0 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
                            aria-label="Quitar producto"
                            title="Quitar producto"
                            onClick={() => removeItem(item.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
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

      <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
        <Card className="p-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total final
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
              {formatARS(total)}
            </p>
            {surchargeAmount > 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Subtotal {formatARS(subtotal)} - Recargo {formatARS(surchargeAmount)}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <SummaryValue label="Pagado" value={formatARS(totalPaid)} />
            <SummaryValue
              label={overpaid > 0 ? "Excedente" : "Pendiente"}
              value={formatARS(overpaid > 0 ? overpaid : remaining)}
              tone={overpaid > 0 ? "error" : remaining === 0 ? "ok" : "default"}
            />
          </div>

          <div
            className={cn(
              "mt-4 rounded-lg border px-3 py-2 text-sm font-medium",
              paymentsDisabled
                ? "border-gray-200 bg-gray-50 text-gray-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400"
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
                  if (nextMethod !== "CREDIT") {
                    setInstallments(1);
                  }
                  if (nextMethod !== "CURRENT_ACCOUNT") {
                    setCustomerResults([]);
                  }
                }}
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>

            {paymentMethod === "CREDIT" ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Cuotas
                  </span>
                  <Select
                    value={installments}
                    disabled={paymentsDisabled || Boolean(creditPayment)}
                    onChange={(event) => setInstallments(Number(event.target.value))}
                  >
                    {CREDIT_INSTALLMENT_OPTIONS.map((option) => (
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
                      installments > 0 ? roundMoney(total / installments) : total
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
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Importe
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
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isPending || paymentsDisabled}
              onClick={addPayment}
            >
              Agregar pago
            </Button>
          </div>

          {payments.length > 0 ? (
            <div className="mt-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">
                Pagos cargados
              </h2>
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={cancelSale}>
                  Nueva venta
                </Button>
                <LinkButton size="sm" href={`/ventas/${saleSuccess.saleId}/ticket`}>
                  Ver ticket
                </LinkButton>
                <LinkButton size="sm" href={`/ventas/${saleSuccess.saleId}`}>
                  Ver venta
                </LinkButton>
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
              className="h-14 text-base"
              onClick={finishSale}
            >
              {isPending ? "Confirmando..." : "Finalizar venta"}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelSale}>
              Cancelar venta
            </Button>
          </div>
        </Card>
      </aside>
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
      <h2 className="text-sm font-semibold text-gray-950 dark:text-gray-50">{title}</h2>
      <div
        className={cn(
          "mt-3 grid gap-2",
          compact
            ? "grid-cols-2 sm:grid-cols-4 2xl:grid-cols-6"
            : "sm:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {products.map((product, index) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onAddProduct(product)}
            className={cn(
              "rounded-lg border border-gray-200 bg-gray-50 text-left transition duration-150 hover:bg-white active:scale-[0.995] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900",
              compact ? "p-2.5" : "p-3",
              selectedIndex === index &&
                "border-brand-500 bg-brand-50 ring-2 ring-brand-100 dark:border-brand-400 dark:bg-brand-950/40 dark:ring-brand-900/70"
            )}
          >
            <span
              className={cn(
                "line-clamp-2 text-sm font-medium text-gray-950 dark:text-gray-50",
                compact ? "min-h-9" : "min-h-10"
              )}
            >
              {product.name}
            </span>
            <span className={cn("block text-sm font-semibold text-gray-950 dark:text-gray-50", compact ? "mt-1.5" : "mt-2")}>
              {formatARS(product.salePrice)}
            </span>
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold text-gray-950 dark:text-gray-50",
          tone === "ok" && "text-emerald-700 dark:text-emerald-300",
          tone === "error" && "text-red-700 dark:text-red-300"
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
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

function isValidQuantity(quantity: string, item: CartItem) {
  const value = safeNumber(quantity);
  if (value <= 0 || value > safeNumber(item.stock)) {
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

function createPaymentId() {
  return globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
}
