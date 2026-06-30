"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Badge } from "@/components/ui/badge";
import { BarcodeFeedback } from "@/components/barcode/barcode-feedback";
import { MercadoPagoQrModal } from "@/components/payments/mercado-pago-qr-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrashIcon } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { PrintButton } from "@/components/ui/print-button";
import { recordTicketPrintAction } from "@/app/(sales)/ventas/print-actions";
import { copyTextToClipboard } from "@/lib/clipboard";
import type {
  MercadoPagoAccountView,
  MercadoPagoAttemptView,
  MercadoPagoMovementView
} from "@/lib/mercadopago/mercado-pago-types";
import { formatARS } from "@/lib/money";
import { providerStatusLabel } from "@/lib/payment-display";
import type {
  CreditInstallmentPlanView,
  PaymentMethodSettingView
} from "@/lib/payment-settings";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";
import type { PrintSettingView } from "@/lib/print-settings";
import { buildTicketHref } from "@/lib/return-to";
import { useBarcodeScanner } from "@/lib/barcode/use-barcode-scanner";
import { cn } from "@/lib/ui";
import {
  associateMercadoPagoPaymentAction,
  cancelMercadoPagoAttemptAction,
  confirmRegisterSaleAction,
  createMercadoPagoQrAttemptAction,
  findMercadoPagoAmountMatchesAction,
  findCashProductByBarcodeAction,
  refreshMercadoPagoAttemptStatusAction,
  searchCashCustomersAction,
  type CashProductResult,
  type CashCustomerResult,
  searchCashProductsAction,
  searchRecentMercadoPagoPaymentsAction
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
  externalId?: string;
  externalReference?: string;
  providerStatus?: string;
  paymentAttemptId?: string;
  mercadoPagoAccountName?: string;
  mercadoPagoOrigin?: string;
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

type BarcodeMessage = {
  code: string;
  message: string;
  tone: "ok" | "error" | "info";
};

type CashRegisterProps = {
  initialSuggestedProducts: CashProductResult[];
  paymentMethods: PaymentMethodSettingView[];
  creditPlans: CreditInstallmentPlanView[];
  printSetting: PrintSettingView;
  fiscalSetting: FiscalSettingView;
  mercadoPagoAccounts: MercadoPagoAccountView[];
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
  mercadoPagoAccounts,
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
  const paymentSettingsByMethod = useMemo(
    () =>
      Object.fromEntries(
        paymentMethods.map((method) => [method.method, method])
      ) as Record<PaymentMethodValue, PaymentMethodSettingView | undefined>,
    [paymentMethods]
  );
  const defaultMercadoPagoAccountId =
    mercadoPagoAccounts.find((account) => account.defaultAccount)?.id ??
    mercadoPagoAccounts[0]?.id ??
    "";
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
  const [paymentReference, setPaymentReference] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [mercadoPagoAccountId, setMercadoPagoAccountId] = useState(
    defaultMercadoPagoAccountId
  );
  const [mercadoPagoAttempt, setMercadoPagoAttempt] =
    useState<MercadoPagoAttemptView | null>(null);
  const [mercadoPagoMovements, setMercadoPagoMovements] = useState<
    MercadoPagoMovementView[]
  >([]);
  const [mercadoPagoMessage, setMercadoPagoMessage] = useState<string | null>(null);
  const [mercadoPagoTechnicalDetail, setMercadoPagoTechnicalDetail] = useState<
    string | null
  >(null);
  const [mercadoPagoQrModalOpen, setMercadoPagoQrModalOpen] = useState(false);
  const [mercadoPagoMovementsModalOpen, setMercadoPagoMovementsModalOpen] =
    useState(false);
  const [mercadoPagoMatchPollingEnabled, setMercadoPagoMatchPollingEnabled] =
    useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CashCustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CashCustomerResult | null>(null);
  const [pendingFiscalPayments, setPendingFiscalPayments] = useState<PaymentEntry[] | null>(null);
  const [barcodeMessage, setBarcodeMessage] = useState<BarcodeMessage | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<SaleSuccess | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const mercadoPagoMatchSearchInFlightRef = useRef(false);
  const mercadoPagoLastMatchSearchAtRef = useRef(0);

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
  const selectedPaymentSetting = paymentSettingsByMethod[paymentMethod];
  const isMercadoPagoApiMode =
    paymentMethod === "MERCADOPAGO" &&
    selectedPaymentSetting?.mercadoPagoMode === "API_QR";
  const selectedMercadoPagoAccount =
    mercadoPagoAccounts.find((account) => account.id === mercadoPagoAccountId) ??
    mercadoPagoAccounts[0] ??
    null;
  const mercadoPagoPollSeconds = normalizeMercadoPagoPollSeconds(
    selectedMercadoPagoAccount?.amountMatchingPollSeconds
  );
  const mercadoPagoMatchCandidates = useMemo(
    () =>
      selectedMercadoPagoAccount
        ? mercadoPagoMovements.filter((movement) =>
            isMercadoPagoMovementAmountMatch({
              movement,
              targetAmount: remaining,
              tolerance: selectedMercadoPagoAccount.amountMatchingTolerance
            })
          )
        : [],
    [mercadoPagoMovements, remaining, selectedMercadoPagoAccount]
  );
  const showPaymentReference =
    !isMercadoPagoApiMode &&
    shouldShowPaymentReference(paymentMethod, selectedPaymentSetting);
  const projectedPaymentMethods = useMemo(
    () => buildProjectedPaymentMethods(payments, paymentMethod, remaining),
    [payments, paymentMethod, remaining]
  );
  const fiscalMode = getFiscalModeForMethods(fiscalSetting, projectedPaymentMethods);
  const willAutoFiscal = fiscalSetting.enabled && fiscalMode === "AUTO";
  const mercadoPagoAttemptId = mercadoPagoAttempt?.id ?? null;
  const mercadoPagoAttemptStatus = mercadoPagoAttempt?.status ?? null;
  const applyApprovedMercadoPagoAttempt = useCallback(
    (attempt: MercadoPagoAttemptView) => {
      const amount = roundMoney(safeNumber(attempt.amount));
      if (attempt.status !== "APPROVED" || amount <= 0) {
        return;
      }

      setPayments((currentPayments) => {
        if (
          currentPayments.some(
            (payment) =>
              payment.paymentAttemptId === attempt.id ||
              (attempt.providerPaymentId &&
                payment.externalId === attempt.providerPaymentId) ||
              (!attempt.providerPaymentId &&
                payment.externalReference === attempt.externalReference)
          )
        ) {
          return currentPayments;
        }

        const applied = roundMoney(
          currentPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0)
        );
        const currentRemaining = Math.max(roundMoney(total - applied), 0);
        if (amount > currentRemaining + 0.01) {
          setMessage({
            text: "El pago aprobado supera el saldo pendiente de esta venta.",
            tone: "error"
          });
          return currentPayments;
        }

        setMessage({
          text: "Pago Mercado Pago aprobado y aplicado a la venta.",
          tone: "ok"
        });
        return [
          ...currentPayments,
          {
            id: createPaymentId(),
            method: "MERCADOPAGO",
            amount: String(amount),
            externalId: attempt.providerPaymentId ?? attempt.externalReference,
            externalReference: attempt.externalReference,
            providerStatus: "APPROVED",
            paymentAttemptId: attempt.id,
            mercadoPagoAccountName: attempt.accountName,
            mercadoPagoOrigin:
              attempt.origin === "AMOUNT_MATCH" ? "Match por monto" : "QR API"
          }
        ];
      });
    },
    [total]
  );

  useBarcodeScanner({
    enabled: !pendingFiscalPayments,
    preventDefaultOnScan: true,
    onScan: handleBarcodeScan
  });

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

  useEffect(() => {
    if (
      !isMercadoPagoApiMode ||
      !mercadoPagoAttemptId ||
      mercadoPagoAttemptStatus !== "PENDING"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(async () => {
        const result = await refreshMercadoPagoAttemptStatusAction(mercadoPagoAttemptId);
        if (!result.ok || !result.attempt) {
          return;
        }
        setMercadoPagoAttempt(result.attempt);
        setMercadoPagoMessage(getMercadoPagoAttemptMessage(result.attempt));
        applyApprovedMercadoPagoAttempt(result.attempt);
      });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [
    applyApprovedMercadoPagoAttempt,
    isMercadoPagoApiMode,
    mercadoPagoAttemptId,
    mercadoPagoAttemptStatus,
    startTransition
  ]);

  useEffect(() => {
    if (
      !isMercadoPagoApiMode ||
      !selectedMercadoPagoAccount?.enableAmountMatching ||
      !mercadoPagoMatchPollingEnabled ||
      remaining <= 0 ||
      saleSuccess ||
      mercadoPagoAttemptStatus === "PENDING" ||
      mercadoPagoAttemptStatus === "APPROVED"
    ) {
      return;
    }

    let cancelled = false;

    const runSearch = () => {
      if (mercadoPagoMatchSearchInFlightRef.current) {
        return;
      }

      const now = Date.now();
      if (now - mercadoPagoLastMatchSearchAtRef.current < 5000) {
        setMercadoPagoMessage(
          "La busqueda se pauso para evitar consultas repetidas. Reintenta en unos segundos."
        );
        return;
      }

      mercadoPagoMatchSearchInFlightRef.current = true;
      mercadoPagoLastMatchSearchAtRef.current = now;
      setMercadoPagoMessage(
        `Buscando coincidencias cada ${mercadoPagoPollSeconds}s...`
      );

      startTransition(async () => {
        const result = await findMercadoPagoAmountMatchesAction({
          accountId: selectedMercadoPagoAccount.id,
          amount: String(roundMoney(remaining))
        });

        mercadoPagoMatchSearchInFlightRef.current = false;
        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setMercadoPagoMessage(
            result.error ?? "No se pudieron consultar cobros recientes."
          );
          setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
          return;
        }

        setMercadoPagoMovements(result.movements);
        setMercadoPagoTechnicalDetail(null);

        if (result.movements.length === 0) {
          setMercadoPagoMessage("Sin coincidencias recientes.");
          return;
        }

        if (result.movements.length > 1) {
          setMercadoPagoMessage(
            "Hay multiples cobros por el mismo monto. Elegi manualmente."
          );
          setMercadoPagoMovementsModalOpen(true);
          return;
        }

        const candidate = result.movements[0];
        setMercadoPagoMessage("1 coincidencia encontrada.");
        setMercadoPagoMovementsModalOpen(true);

        if (
          selectedMercadoPagoAccount.amountMatchingAutoApprove &&
          isMercadoPagoMovementApproved(candidate) &&
          !candidate.alreadyUsed &&
          isMercadoPagoExactAmountMatch(candidate.amount, remaining)
        ) {
          const associateResult = await associateMercadoPagoPaymentAction({
            accountId: selectedMercadoPagoAccount.id,
            paymentId: candidate.id,
            amount: String(roundMoney(remaining))
          });
          if (!associateResult.ok || !associateResult.attempt) {
            setMercadoPagoMessage(
              associateResult.error ?? "No se pudo asociar el pago."
            );
            setMercadoPagoTechnicalDetail(associateResult.technicalDetail ?? null);
            return;
          }

          setMercadoPagoMatchPollingEnabled(false);
          setMercadoPagoMovementsModalOpen(false);
          setMercadoPagoAttempt(associateResult.attempt);
          setMercadoPagoMessage("Pago Mercado Pago autoasociado y aplicado.");
          setMercadoPagoTechnicalDetail(null);
          applyApprovedMercadoPagoAttempt(associateResult.attempt);
        }
      });
    };

    runSearch();
    const timer = window.setInterval(runSearch, mercadoPagoPollSeconds * 1000);

    return () => {
      cancelled = true;
      mercadoPagoMatchSearchInFlightRef.current = false;
      window.clearInterval(timer);
    };
  }, [
    applyApprovedMercadoPagoAttempt,
    isMercadoPagoApiMode,
    mercadoPagoAttemptStatus,
    mercadoPagoMatchPollingEnabled,
    mercadoPagoPollSeconds,
    remaining,
    saleSuccess,
    selectedMercadoPagoAccount?.amountMatchingAutoApprove,
    selectedMercadoPagoAccount?.enableAmountMatching,
    selectedMercadoPagoAccount?.id,
    startTransition
  ]);

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

  function handleBarcodeScan(code: string) {
    setSaleSuccess(null);
    startTransition(async () => {
      const result = await findCashProductByBarcodeAction(code);

      if (result.status === "found") {
        const added = addProduct(result.product);
        if (added) {
          setBarcodeMessage({
            code,
            message: `Producto encontrado: ${result.product.name}.`,
            tone: "ok"
          });
        }
        return;
      }

      const messageByStatus = {
        not_found: "No se encontro producto con ese codigo.",
        inactive: `El producto ${result.status === "inactive" ? result.productName : ""} esta inactivo.`,
        deleted: `El producto ${result.status === "deleted" ? result.productName : ""} esta eliminado.`,
        out_of_stock: `El producto ${result.status === "out_of_stock" ? result.productName : ""} no tiene stock disponible.`
      };

      setBarcodeMessage({
        code,
        message: messageByStatus[result.status],
        tone: "error"
      });
      showMessage(messageByStatus[result.status], "error");
    });
  }

  function addProduct(product: CashProductResult) {
    setSaleSuccess(null);
    setMessage(null);

    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      const nextQuantity = increaseQuantity(existing.quantity, product);
      if (!allowNegativeStock && safeNumber(nextQuantity) > safeNumber(product.stock)) {
        showMessage(`Stock insuficiente para ${product.name}.`, "error");
        return false;
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
    return true;
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

    if (isMercadoPagoApiMode) {
      showMessage("Genera un QR o asocia un pago aprobado de Mercado Pago.", "error");
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

    const metadata = buildPaymentMetadata(paymentMethod);
    if (!metadata.ok) {
      showMessage(metadata.error, "error");
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
          receivedAmount: String(receivedAmount),
          ...metadata.data
        }
      ]);
      setCashReceived("");
      setPaymentAmount("");
      resetPaymentMetadata();
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
        ...metadata.data,
        customerId:
          paymentMethod === "CURRENT_ACCOUNT" ? selectedCustomer?.id : undefined,
        customerName:
          paymentMethod === "CURRENT_ACCOUNT" ? selectedCustomer?.name : undefined
      }
    ]);
    setPaymentAmount(shouldAutofillPaymentAmount(paymentMethod) ? AUTO_PAYMENT_AMOUNT : "");
    setCashReceived("");
    resetPaymentMetadata();
    setCustomerQuery("");
    setCustomerResults([]);
    setMessage(null);
  }

  function generateMercadoPagoQr() {
    if (!selectedMercadoPagoAccount) {
      showMessage("Configura una cuenta Mercado Pago API activa.", "error");
      return;
    }
    if (remaining <= 0) {
      showMessage("No hay saldo pendiente para generar QR.", "error");
      return;
    }

    setMercadoPagoMessage("Generando orden QR...");
    setMercadoPagoTechnicalDetail(null);
    startTransition(async () => {
      const result = await createMercadoPagoQrAttemptAction({
        accountId: selectedMercadoPagoAccount.id,
        amount: String(roundMoney(remaining))
      });

      if (!result.ok) {
        setMercadoPagoMessage(result.error ?? "No se pudo generar el QR.");
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        showMessage(result.error ?? "No se pudo generar el QR.", "error");
        return;
      }

      setMercadoPagoAttempt(result.attempt);
      setMercadoPagoMessage(getMercadoPagoAttemptMessage(result.attempt));
      setMercadoPagoTechnicalDetail(null);
      setMercadoPagoQrModalOpen(true);
      applyApprovedMercadoPagoAttempt(result.attempt);
    });
  }

  function refreshMercadoPagoAttempt(manual = true) {
    if (!mercadoPagoAttempt) {
      return;
    }

    if (manual) {
      setMercadoPagoMessage("Consultando estado en Mercado Pago...");
    }
    startTransition(async () => {
      const result = await refreshMercadoPagoAttemptStatusAction(mercadoPagoAttempt.id);
      if (!result.ok || !result.attempt) {
        setMercadoPagoMessage(result.error ?? "No se pudo consultar Mercado Pago.");
        return;
      }
      setMercadoPagoAttempt(result.attempt);
      setMercadoPagoMessage(getMercadoPagoAttemptMessage(result.attempt));
      applyApprovedMercadoPagoAttempt(result.attempt);
    });
  }

  function cancelMercadoPagoQrAttempt() {
    if (!mercadoPagoAttempt) {
      return;
    }

    startTransition(async () => {
      const result = await cancelMercadoPagoAttemptAction(mercadoPagoAttempt.id);
      if (!result.ok || !result.attempt) {
        setMercadoPagoMessage(result.error ?? "No se pudo cancelar el intento.");
        return;
      }
      setMercadoPagoAttempt(null);
      setMercadoPagoQrModalOpen(false);
      setMercadoPagoMessage("Intento Mercado Pago cancelado.");
    });
  }

  function searchMercadoPagoMovements() {
    if (!selectedMercadoPagoAccount) {
      showMessage("Selecciona una cuenta Mercado Pago.", "error");
      return;
    }

    setMercadoPagoMovementsModalOpen(true);
    setMercadoPagoMessage("Buscando ultimos cobros Mercado Pago...");
    setMercadoPagoTechnicalDetail(null);
    startTransition(async () => {
      const result = await searchRecentMercadoPagoPaymentsAction({
        accountId: selectedMercadoPagoAccount.id,
        minutes: selectedMercadoPagoAccount.amountMatchingWindowMinutes,
        limit: 20
      });
      if (!result.ok) {
        setMercadoPagoMessage(
          result.error ?? "No se pudieron consultar cobros recientes."
        );
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        return;
      }
      setMercadoPagoMovements(result.movements);
      setMercadoPagoTechnicalDetail(null);
      setMercadoPagoMessage(
        result.movements.length > 0
          ? "Ultimos cobros detectados."
          : "Mercado Pago no devolvio cobros para esta cuenta."
      );
    });
  }

  function findMercadoPagoMatches() {
    if (!selectedMercadoPagoAccount) {
      showMessage("Selecciona una cuenta Mercado Pago.", "error");
      return;
    }
    if (remaining <= 0) {
      showMessage("No hay saldo pendiente para matchear.", "error");
      return;
    }

    setMercadoPagoMovementsModalOpen(true);
    setMercadoPagoMessage("Buscando coincidencias por monto...");
    setMercadoPagoTechnicalDetail(null);
    startTransition(async () => {
      const result = await findMercadoPagoAmountMatchesAction({
        accountId: selectedMercadoPagoAccount.id,
        amount: String(roundMoney(remaining))
      });
      if (!result.ok) {
        setMercadoPagoMessage(
          result.error ?? "Sin coincidencias por el monto pendiente."
        );
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        return;
      }
      setMercadoPagoMovements(result.movements);
      setMercadoPagoTechnicalDetail(null);
      setMercadoPagoMessage(
        result.movements.length > 0
          ? "Coincidencias encontradas para el saldo pendiente."
          : "Sin coincidencias por el monto pendiente."
      );
    });
  }

  function associateMercadoPagoMovement(
    movement: MercadoPagoMovementView,
    options?: { skipConfirm?: boolean }
  ) {
    if (!selectedMercadoPagoAccount) {
      return;
    }

    if (
      !options?.skipConfirm &&
      !window.confirm(
        [
          "Asociar este cobro Mercado Pago a la venta actual?",
          `Monto: ${formatARS(movement.amount)}`,
          `Cuenta: ${selectedMercadoPagoAccount.name}`,
          `Pago: ${movement.id}`,
          `Estado: ${mercadoPagoMovementStatusLabel(movement.status)}`
        ].join("\n")
      )
    ) {
      return;
    }

    setMercadoPagoMatchPollingEnabled(false);
    setMercadoPagoTechnicalDetail(null);
    startTransition(async () => {
      const result = await associateMercadoPagoPaymentAction({
        accountId: selectedMercadoPagoAccount.id,
        paymentId: movement.id,
        amount: String(roundMoney(remaining))
      });
      if (!result.ok || !result.attempt) {
        setMercadoPagoMessage(result.error ?? "No se pudo asociar el pago.");
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        return;
      }
      setMercadoPagoAttempt(result.attempt);
      setMercadoPagoMovementsModalOpen(false);
      setMercadoPagoMessage("Pago Mercado Pago asociado y aplicado.");
      setMercadoPagoTechnicalDetail(null);
      applyApprovedMercadoPagoAttempt(result.attempt);
    });
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
    setPaymentReference("");
    setCashReceived("");
    setInstallments(defaultInstallments);
    setPaymentMethod(defaultPaymentMethod);
    setPendingFiscalPayments(null);
    setMessage(null);
    setCopyFeedback(null);
    setMercadoPagoAttempt(null);
    setMercadoPagoMovements([]);
    setMercadoPagoMessage(null);
    setMercadoPagoTechnicalDetail(null);
    setMercadoPagoQrModalOpen(false);
    setMercadoPagoMovementsModalOpen(false);
    setMercadoPagoMatchPollingEnabled(false);
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
          installments: payment.method === "CREDIT" ? payment.installments : undefined,
          externalId: payment.externalId,
          externalReference: payment.externalReference,
          providerStatus: payment.providerStatus,
          paymentAttemptId: payment.paymentAttemptId
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
      setPaymentReference("");
      setCashReceived("");
      setInstallments(defaultInstallments);
      setPaymentMethod(defaultPaymentMethod);
      setCustomerQuery("");
      setCustomerResults([]);
      setSelectedCustomer(null);
      setCopyFeedback(null);
      setMercadoPagoAttempt(null);
      setMercadoPagoMovements([]);
      setMercadoPagoMessage(null);
      setMercadoPagoTechnicalDetail(null);
      setMercadoPagoQrModalOpen(false);
      setMercadoPagoMovementsModalOpen(false);
      setMercadoPagoMatchPollingEnabled(false);
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

  function resetPaymentMetadata() {
    setPaymentReference("");
    setCopyFeedback(null);
  }

  function buildPaymentMetadata(method: PaymentMethodValue):
    | {
        ok: true;
        data: Pick<
          PaymentEntry,
          "externalId" | "externalReference" | "providerStatus"
        >;
      }
    | { ok: false; error: string } {
    const setting = paymentSettingsByMethod[method];
    const reference = paymentReference.trim();

    if (shouldShowPaymentReference(method, setting) && !reference) {
      return {
        ok: false,
        error: "Ingresa la referencia o numero de operacion del pago."
      };
    }

    return {
      ok: true,
      data: {
        externalId: reference || undefined,
        externalReference: reference || undefined,
        providerStatus: setting?.defaultProviderStatus ?? undefined
      }
    };
  }

  async function copyPaymentData(label: string, value: string | null | undefined) {
    const ok = await copyTextToClipboard(value ?? "");
    setCopyFeedback(ok ? `${label} copiado.` : `No se pudo copiar ${label.toLowerCase()}.`);
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
    if (isMercadoPagoApiMode) {
      return {
        ok: false,
        error: "Mercado Pago API QR requiere un pago aprobado antes de finalizar."
      };
    }

    const metadata = buildPaymentMetadata(paymentMethod);
    if (!metadata.ok) {
      return metadata;
    }

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
          receivedAmount: String(receivedAmount),
          ...metadata.data
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
          installments: selectedCreditOption.installments,
          ...metadata.data
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
          ...metadata.data,
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
        amount: String(amount),
        ...metadata.data
      }
    };
  }

  return (
    <section
      className="grid min-h-[calc(100vh-12rem)] gap-3 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:gap-4"
      onKeyDown={handlePanelKeyDown}
    >
      <div className="min-w-0 space-y-3 2xl:space-y-4">
        <Card className="pos-accent-line p-3 pl-4 shadow-lg shadow-[#5B6B79]/10 ring-1 ring-white/70 dark:shadow-none dark:ring-0 2xl:p-4 2xl:pl-5">
          <form
            className="input-base flex flex-col gap-2 rounded-lg p-2 shadow-inner shadow-[#5B6B79]/10 dark:shadow-none sm:flex-row sm:gap-3"
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
              className="h-12 border-transparent bg-transparent text-base font-semibold shadow-none focus:border-transparent focus:ring-0 dark:bg-transparent dark:text-[#F3F7FA] dark:placeholder:text-[#7F8D9A] dark:shadow-none"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || query.trim().length === 0}
              className="shrink-0 px-6"
            >
              Buscar
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
            <Badge tone="blue">F1 Buscar</Badge>
            <Badge tone="green">Enter Agregar</Badge>
            <Badge tone="amber">F4 Cobrar</Badge>
            <Badge tone="neutral">Esc Limpiar</Badge>
          </div>

          <div className="mt-3">
            <BarcodeFeedback
              code={barcodeMessage?.code ?? null}
              message={barcodeMessage?.message ?? null}
              tone={barcodeMessage?.tone}
            />
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

        <Card className="overflow-hidden shadow-lg shadow-[#5B6B79]/10 dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Cantidad</th>
                  <th className="px-4 py-3 font-semibold">Precio</th>
                  <th className="px-4 py-3 font-semibold">Subtotal</th>
                  <th className="px-4 py-3 text-right font-semibold">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)]">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
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
                        className="transition-colors hover:bg-[var(--panel-bg-elevated)]"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-[var(--text-primary)]">
                            {item.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
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
                            <span className="text-xs text-[var(--text-muted)]">
                              {unitLabel(item.unitType)}
                            </span>
                          </div>
                          {invalid ? (
                            <p className="mt-1 text-xs text-[var(--danger)]">
                              {stockExceeded
                                ? "Supera el stock disponible."
                                : "Cantidad invalida."}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[var(--text-secondary)]">{formatARS(item.salePrice)}</td>
                        <td className="px-4 py-3.5 font-semibold text-[var(--text-primary)]">
                          {formatARS(subtotalItem)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            className="btn-danger inline-flex h-9 w-10 items-center justify-center rounded-md border shadow-sm transition-colors duration-150 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--danger)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1015]"
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
        <Card className="border-t-4 border-t-[color:var(--primary)] p-4 shadow-xl shadow-[#5B6B79]/14 ring-1 ring-white/80 dark:shadow-none dark:ring-0 2xl:p-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Consola de cobro
            </p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Total final
            </p>
            <p className="mt-1 text-4xl font-black tracking-tight text-[var(--text-primary)] 2xl:text-5xl">
              {formatARS(total)}
            </p>
            {surchargeAmount > 0 ? (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
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
                ? "badge-neutral"
                : remaining === 0 && overpaid === 0
                  ? "badge-success"
                  : overpaid > 0
                    ? "badge-danger"
                    : "badge-warning"
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

          <p className="app-panel-elevated mt-3 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)]">
            {paymentsDisabled
              ? "Agrega productos para elegir el medio de pago."
              : payments.length === 0
                ? `Se cobrara el total con ${paymentLabels[paymentMethod]}.`
                : paymentsMatch
                  ? "Pago completo con los pagos cargados."
                  : `Pagos parciales cargados. Pendiente ${formatARS(remaining)}.`}
          </p>

          <div className={cn("mt-4 space-y-4", paymentsDisabled && "opacity-75")}>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
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
                  setPaymentReference("");
                  setCopyFeedback(null);
                  setMercadoPagoMessage(null);
                  setMercadoPagoTechnicalDetail(null);
                  setMercadoPagoMovements([]);
                  setMercadoPagoMovementsModalOpen(false);
                  setMercadoPagoMatchPollingEnabled(false);
                  if (nextMethod !== "CURRENT_ACCOUNT") {
                    setCustomerResults([]);
                    setSelectedCustomer(null);
                    setCustomerQuery("");
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

            {isMercadoPagoApiMode ? (
              <MercadoPagoApiPanel
                accounts={mercadoPagoAccounts}
                selectedAccountId={mercadoPagoAccountId}
                selectedAccount={selectedMercadoPagoAccount}
                attempt={mercadoPagoAttempt}
                message={mercadoPagoMessage}
                technicalDetail={mercadoPagoTechnicalDetail}
                disabled={paymentsDisabled || isPending}
                remaining={remaining}
                matchCount={mercadoPagoMatchCandidates.length}
                pollSeconds={mercadoPagoPollSeconds}
                pollingEnabled={mercadoPagoMatchPollingEnabled}
                onAccountChange={(accountId) => {
                  setMercadoPagoAccountId(accountId);
                  setMercadoPagoAttempt(null);
                  setMercadoPagoMovements([]);
                  setMercadoPagoMessage(null);
                  setMercadoPagoTechnicalDetail(null);
                  setMercadoPagoQrModalOpen(false);
                  setMercadoPagoMovementsModalOpen(false);
                  setMercadoPagoMatchPollingEnabled(false);
                }}
                onGenerate={generateMercadoPagoQr}
                onOpenQr={() => setMercadoPagoQrModalOpen(true)}
                onRefresh={() => refreshMercadoPagoAttempt(true)}
                onCancel={cancelMercadoPagoQrAttempt}
                onSearchRecent={searchMercadoPagoMovements}
                onFindMatches={findMercadoPagoMatches}
                onTogglePolling={() =>
                  setMercadoPagoMatchPollingEnabled((enabled) => !enabled)
                }
              />
            ) : (
              <PaymentMethodInfo
                method={paymentMethod}
                setting={selectedPaymentSetting}
                disabled={paymentsDisabled}
                copyFeedback={copyFeedback}
                onCopy={copyPaymentData}
              />
            )}

            {paymentMethod === "CREDIT" ? (
              <div className="app-panel-elevated space-y-3 rounded-lg p-4 shadow-sm dark:shadow-none">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
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
                <div className="text-sm text-[var(--text-secondary)]">
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

            {showPaymentReference ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Referencia / operacion
                </span>
                <Input
                  value={paymentReference}
                  disabled={paymentsDisabled}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Numero de operacion, cupon o autorizacion"
                />
                <span className="block text-xs text-[var(--warning)]">
                  Este medio requiere referencia para finalizar el pago.
                </span>
              </label>
            ) : null}

            {isMercadoPagoApiMode ? null : paymentMethod === "CURRENT_ACCOUNT" ? (
              <div className="badge-warning space-y-3 rounded-lg p-4">
                <p className="text-sm font-medium">
                  Esta venta se cargara a cuenta corriente.
                </p>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
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
                        className="app-panel-elevated w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-[var(--primary-soft)]"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery(customer.name);
                          setCustomerResults([]);
                        }}
                      >
                        <span className="block font-medium text-[var(--text-primary)]">
                          {customer.name}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {[customer.document, customer.phone].filter(Boolean).join(" - ") ||
                            "Sin documento"}
                          {" · "}Saldo {formatARS(customer.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedCustomer ? (
                  <div className="app-panel-elevated rounded-md px-3 py-2 text-sm">
                    <p className="font-medium text-[var(--text-primary)]">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Saldo actual {formatARS(selectedCustomer.balance)}
                    </p>
                  </div>
                ) : null}
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
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
                  className="btn-secondary"
                  disabled={paymentsDisabled || remaining <= 0}
                  onClick={fillPendingAmount}
                >
                  Completar con pendiente
                </Button>
              </div>
            ) : paymentMethod === "CASH" ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
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
                      className="btn-secondary"
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
                  <span className="text-sm font-medium text-[var(--text-primary)]">
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
                  className="btn-secondary"
                  disabled={paymentsDisabled || remaining <= 0}
                  onClick={fillPendingAmount}
                >
                  Completar con pendiente
                </Button>
              </div>
            )}

            {!isMercadoPagoApiMode ? (
              <Button
                type="button"
                variant="secondary"
                className="btn-secondary w-full"
                disabled={
                  isPending ||
                  paymentsDisabled ||
                  (paymentMethod === "CREDIT" && creditPlans.length === 0)
                }
                onClick={addPayment}
              >
                Agregar pago parcial
              </Button>
            ) : null}
          </div>

          {fiscalSetting.enabled && cart.length > 0 && fiscalMode !== "ASK" ? (
            <div className="app-panel-elevated mt-4 rounded-lg p-3 text-sm shadow-sm dark:shadow-none">
              <p className="font-semibold text-[var(--text-primary)]">
                Facturacion
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                {willAutoFiscal
                  ? "Esta venta quedara pendiente de facturacion."
                  : "Esta venta quedara como ticket interno."}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                No se emite comprobante real en ARCA en esta etapa.
              </p>
            </div>
          ) : null}

          {payments.length > 0 ? (
            <div className="mt-5 space-y-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Pagos cargados
              </h2>
              {payments.map((payment) => (
                <PaymentEntryRow
                  key={payment.id}
                  payment={payment}
                  label={paymentLabels[payment.method]}
                  onRemove={() => removePayment(payment.id)}
                />
              ))}
            </div>
          ) : null}

          {saleSuccess ? (
            <div className="badge-success mt-4 rounded-md px-3 py-3 text-sm">
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
                  ? "badge-success mt-4 rounded-md px-3 py-2 text-sm"
                  : "badge-danger mt-4 rounded-md px-3 py-2 text-sm"
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
              className="h-14 w-full text-base font-bold tracking-wide shadow-[0_14px_30px_rgba(46,91,122,0.18)] transition-all duration-200 hover:shadow-[0_18px_36px_rgba(46,91,122,0.28)] active:scale-[0.99] disabled:shadow-none"
              onClick={finishSale}
            >
              {isPending ? "Confirmando..." : "Finalizar venta"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="btn-secondary"
              onClick={cancelSale}
            >
              Cancelar venta
            </Button>
          </div>
        </Card>
      </aside>
      <MercadoPagoQrModal
        open={mercadoPagoQrModalOpen}
        attempt={mercadoPagoAttempt}
        account={selectedMercadoPagoAccount}
        message={mercadoPagoMessage}
        technicalDetail={mercadoPagoTechnicalDetail}
        pending={isPending}
        onClose={() => setMercadoPagoQrModalOpen(false)}
        onRefresh={() => refreshMercadoPagoAttempt(true)}
        onCancel={cancelMercadoPagoQrAttempt}
        onGenerateNew={generateMercadoPagoQr}
      />
      <MercadoPagoMovementsModal
        open={mercadoPagoMovementsModalOpen}
        account={selectedMercadoPagoAccount}
        movements={mercadoPagoMovements}
        targetAmount={remaining}
        matchCount={mercadoPagoMatchCandidates.length}
        message={mercadoPagoMessage}
        technicalDetail={mercadoPagoTechnicalDetail}
        pending={isPending}
        qrPending={mercadoPagoAttemptStatus === "PENDING"}
        onClose={() => setMercadoPagoMovementsModalOpen(false)}
        onRefresh={searchMercadoPagoMovements}
        onFindMatches={findMercadoPagoMatches}
        onAssociate={associateMercadoPagoMovement}
      />
      {pendingFiscalPayments ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fiscal-sale-dialog-title"
        >
          <div className="app-panel w-full max-w-md rounded-lg p-5 shadow-xl dark:shadow-none">
            <h2
              id="fiscal-sale-dialog-title"
              className="text-lg font-semibold text-[var(--text-primary)]"
            >
              Facturacion de la venta
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
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

function MercadoPagoApiPanel({
  accounts,
  selectedAccountId,
  selectedAccount,
  attempt,
  message,
  technicalDetail,
  disabled,
  remaining,
  matchCount,
  pollSeconds,
  pollingEnabled,
  onAccountChange,
  onGenerate,
  onOpenQr,
  onRefresh,
  onCancel,
  onSearchRecent,
  onFindMatches,
  onTogglePolling
}: {
  accounts: MercadoPagoAccountView[];
  selectedAccountId: string;
  selectedAccount: MercadoPagoAccountView | null;
  attempt: MercadoPagoAttemptView | null;
  message: string | null;
  technicalDetail: string | null;
  disabled: boolean;
  remaining: number;
  matchCount: number;
  pollSeconds: number;
  pollingEnabled: boolean;
  onAccountChange: (accountId: string) => void;
  onGenerate: () => void;
  onOpenQr: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onSearchRecent: () => void;
  onFindMatches: () => void;
  onTogglePolling: () => void;
}) {
  const pendingAttempt = attempt?.status === "PENDING";
  const approvedAttempt = attempt?.status === "APPROVED";
  const failedAttempt = Boolean(
    attempt && !["PENDING", "APPROVED"].includes(attempt.status)
  );
  const canOpenQr = Boolean(attempt?.qrCodeDataUrl || attempt);
  const sidebarMessage = getMercadoPagoSidebarMessage(message, attempt);

  if (approvedAttempt && attempt) {
    return (
      <div className="badge-success space-y-2 rounded-lg p-3 text-sm shadow-sm dark:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">
              Mercado Pago aprobado
            </p>
            <p className="mt-1 text-lg font-extrabold text-[var(--success)]">
              {formatARS(attempt.amount)} aplicado a la venta
            </p>
            <p
              className="mt-1 truncate text-xs text-[var(--text-secondary)]"
              title={attempt.accountName}
            >
              Cuenta: {attempt.accountName}
            </p>
          </div>
          <MercadoPagoStatusBadge status={attempt.status} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {canOpenQr ? (
            <Button type="button" size="sm" variant="secondary" onClick={onOpenQr}>
              Ver QR
            </Button>
          ) : null}
        </div>

        <MercadoPagoAttemptTechnicalDetails
          attempt={attempt}
          account={selectedAccount}
          technicalDetail={technicalDetail}
        />
      </div>
    );
  }

  return (
    <div className="app-panel-elevated space-y-3 rounded-lg p-3 text-sm shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">
            Mercado Pago
          </p>
          {attempt ? (
            <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">
              {formatARS(attempt.amount)}{" "}
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                - {mercadoPagoAttemptStatusLabel(attempt.status)}
              </span>
            </p>
          ) : null}
        </div>
        {attempt ? <MercadoPagoStatusBadge status={attempt.status} /> : null}
      </div>

      {attempt ? (
        <div className="space-y-1 text-xs text-[var(--text-secondary)]">
          <p className="truncate" title={attempt.accountName}>
            Cuenta: {attempt.accountName}
          </p>
          <p className="truncate" title={attempt.externalReference}>
            Ref: {shortReference(attempt.externalReference)}
          </p>
        </div>
      ) : (
        <>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Cuenta
            </span>
            <Select
              value={selectedAccountId}
              disabled={disabled || accounts.length === 0}
              onChange={(event) => onAccountChange(event.target.value)}
            >
              {accounts.length === 0 ? (
                <option value="">Sin cuentas activas</option>
              ) : (
                accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} {account.defaultAccount ? "(predeterminada)" : ""}
                  </option>
                ))
              )}
            </Select>
          </label>

          {selectedAccount ? (
            <div className="flex flex-wrap gap-1.5">
              <MercadoPagoInfoBadge>
                {mercadoPagoEnvironmentLabel(selectedAccount.environment)}
              </MercadoPagoInfoBadge>
              <MercadoPagoInfoBadge>
                Match{" "}
                {selectedAccount.enableAmountMatching ? "activo" : "deshabilitado"}
              </MercadoPagoInfoBadge>
            </div>
          ) : null}
        </>
      )}

      {!attempt ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="w-full"
          disabled={disabled || !selectedAccount || remaining <= 0}
          onClick={onGenerate}
        >
          Generar QR
        </Button>
      ) : null}

      {pendingAttempt || failedAttempt ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onOpenQr}>
            Ver QR
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onRefresh}>
            Refrescar
          </Button>
          {pendingAttempt ? (
            <Button type="button" size="sm" variant="danger" onClick={onCancel}>
              Cancelar intento
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={disabled || !selectedAccount || remaining <= 0}
              onClick={onGenerate}
            >
              Nuevo QR
            </Button>
          )}
        </div>
      ) : null}

      {!attempt ? (
        <div className="app-panel-secondary space-y-2 rounded-md px-3 py-2 text-xs">
          {selectedAccount?.enableAmountMatching ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">
                  Match por monto
                </p>
                <p className="truncate text-[var(--text-secondary)]">
                  {pollingEnabled
                    ? `Buscando cada ${pollSeconds}s`
                    : matchCount > 0
                      ? `${matchCount} coincidencia${matchCount === 1 ? "" : "s"}`
                      : `Pendiente ${formatARS(remaining)}`}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={pollingEnabled ? "secondary" : "outline"}
                disabled={disabled || remaining <= 0}
                onClick={onTogglePolling}
              >
                {pollingEnabled ? "Pausar" : "Auto"}
              </Button>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)]">
              Match por monto deshabilitado para esta cuenta.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || !selectedAccount || !selectedAccount.showRecentMovements}
              onClick={onSearchRecent}
            >
              Ultimos cobros
            </Button>
            {selectedAccount?.enableAmountMatching ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled || remaining <= 0}
                onClick={onFindMatches}
              >
                Buscar match
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {attempt ? (
        <MercadoPagoAttemptTechnicalDetails
          attempt={attempt}
          account={selectedAccount}
          technicalDetail={technicalDetail}
        />
      ) : null}

      {sidebarMessage ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            attempt?.status === "ERROR" || failedAttempt
              ? "badge-danger"
              : "badge-neutral"
          )}
        >
          <p>{sidebarMessage}</p>
          {technicalDetail ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">
                Ver detalle tecnico
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
                {technicalDetail}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MercadoPagoInfoBadge({ children }: { children: ReactNode }) {
  return (
    <span className="badge-neutral rounded-full px-2 py-0.5 text-[11px] font-semibold">
      {children}
    </span>
  );
}

function MercadoPagoStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
        status === "APPROVED" && "badge-success",
        status === "PENDING" && "badge-warning",
        status === "ERROR" && "badge-danger",
        !["APPROVED", "PENDING", "ERROR"].includes(status) &&
          "badge-neutral"
      )}
    >
      {mercadoPagoAttemptStatusLabel(status)}
    </span>
  );
}

function MercadoPagoAttemptTechnicalDetails({
  attempt,
  account,
  technicalDetail
}: {
  attempt: MercadoPagoAttemptView;
  account: MercadoPagoAccountView | null;
  technicalDetail: string | null;
}) {
  return (
    <details className="app-panel-secondary rounded-md px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">
        Ver detalle
      </summary>
      <dl className="mt-3 grid gap-2 text-[var(--text-secondary)]">
        <CompactDetailLine label="Cuenta" value={account?.name ?? attempt.accountName} />
        <CompactDetailLine
          label="Origen"
          value={attempt.origin === "QR_ORDER" ? "QR API" : "Match por monto"}
        />
        <CompactDetailLine label="Referencia" value={attempt.externalReference} />
        <CompactDetailLine label="Orden MP" value={attempt.providerOrderId ?? "-"} />
        <CompactDetailLine label="Pago MP" value={attempt.providerPaymentId ?? "-"} />
        <CompactDetailLine label="Raw status" value={attempt.rawStatus ?? "-"} />
        <CompactDetailLine label="Status detail" value={attempt.rawStatusDetail ?? "-"} />
        <CompactDetailLine label="Aprobado" value={formatMercadoPagoDate(attempt.approvedAt)} />
        {technicalDetail ? (
          <CompactDetailLine label="Error" value={technicalDetail} />
        ) : null}
      </dl>
    </details>
  );
}

function CompactDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="font-semibold text-[var(--text-primary)]">{label}</dt>
      <dd className="break-all font-mono text-[11px]">{value}</dd>
    </div>
  );
}

function MercadoPagoMovementsModal({
  open,
  account,
  movements,
  targetAmount,
  matchCount,
  message,
  technicalDetail,
  pending,
  qrPending,
  onClose,
  onRefresh,
  onFindMatches,
  onAssociate
}: {
  open: boolean;
  account: MercadoPagoAccountView | null;
  movements: MercadoPagoMovementView[];
  targetAmount: number;
  matchCount: number;
  message: string | null;
  technicalDetail: string | null;
  pending: boolean;
  qrPending: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onFindMatches: () => void;
  onAssociate: (movement: MercadoPagoMovementView) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cobros recientes Mercado Pago"
    >
      <div className="app-panel flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl dark:shadow-none">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--panel-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Cobros recientes Mercado Pago
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {account
                ? `${account.name} - pendiente ${formatARS(targetAmount)}`
                : "Cuenta Mercado Pago"}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="app-panel-secondary rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)]">
            Mercado Pago puede devolver pagos/cobros recientes de la cuenta.
            Algunos envios manuales podrian no aparecer segun el tipo de operacion.
          </p>

          {qrPending ? (
            <p className="badge-warning mt-3 rounded-lg px-3 py-2 text-xs">
              Hay un QR pendiente. Asociar otro cobro puede duplicar el pago.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onRefresh}>
              Refrescar
            </Button>
            {account?.enableAmountMatching ? (
              <Button type="button" size="sm" variant="primary" onClick={onFindMatches}>
                Buscar coincidencias
              </Button>
            ) : null}
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {matchCount > 0
                ? `${matchCount} coincidencia${matchCount === 1 ? "" : "s"}`
                : "Sin coincidencias destacadas"}
            </span>
          </div>

          {message ? (
            <p className="app-panel-elevated mt-3 rounded-md px-3 py-2 text-xs text-[var(--text-secondary)]">
              {message}
            </p>
          ) : null}

          {technicalDetail ? (
            <details className="badge-danger mt-3 rounded-md px-3 py-2 text-xs">
              <summary className="cursor-pointer font-semibold">
                Ver detalle tecnico
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--panel-border)] bg-[var(--app-bg)] p-2 text-[11px] leading-4 text-[var(--danger)]">
                {technicalDetail}
              </pre>
            </details>
          ) : null}

          <div className="mt-4 space-y-2">
            {movements.length === 0 ? (
              <div className="app-panel-secondary rounded-lg px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                Sin cobros recientes detectados.
              </div>
            ) : (
              movements.map((movement) => (
                <MercadoPagoMovementRow
                  key={movement.id}
                  movement={movement}
                  account={account}
                  targetAmount={targetAmount}
                  disabled={pending}
                  onAssociate={() => onAssociate(movement)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MercadoPagoMovementRow({
  movement,
  account,
  targetAmount,
  disabled,
  onAssociate
}: {
  movement: MercadoPagoMovementView;
  account: MercadoPagoAccountView | null;
  targetAmount: number;
  disabled: boolean;
  onAssociate: () => void;
}) {
  const matchesAmount = account
    ? isMercadoPagoMovementAmountMatch({
        movement,
        targetAmount,
        tolerance: account.amountMatchingTolerance
      })
    : false;
  const approved = isMercadoPagoMovementApproved(movement);

  return (
    <div className="app-panel-elevated rounded-lg p-3 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-extrabold text-[var(--text-primary)]">
              {formatARS(movement.amount)}
            </p>
            <MercadoPagoMovementBadge tone={approved ? "ok" : "muted"}>
              {mercadoPagoMovementStatusLabel(movement.status)}
            </MercadoPagoMovementBadge>
            {matchesAmount ? (
              <MercadoPagoMovementBadge tone="warn">Coincide</MercadoPagoMovementBadge>
            ) : null}
            {movement.alreadyUsed ? (
              <MercadoPagoMovementBadge tone="muted">Usado</MercadoPagoMovementBadge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {formatMercadoPagoDate(movement.dateApproved ?? movement.dateCreated)} - ID{" "}
            {shortReference(movement.id)}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {[movement.paymentMethod, movement.paymentType, movement.operationType]
              .filter(Boolean)
              .join(" - ") || "Metodo no informado"}
          </p>
          {movement.payerLabel || movement.externalReference ? (
            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
              {[movement.payerLabel, movement.externalReference]
                .filter(Boolean)
                .join(" - ")}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={matchesAmount && approved ? "primary" : "secondary"}
          disabled={disabled || movement.alreadyUsed || !approved}
          onClick={onAssociate}
        >
          Usar en esta venta
        </Button>
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">
          Ver detalle tecnico
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--panel-border)] bg-[var(--app-bg)] p-2 text-[11px] text-[var(--text-secondary)]">
          {JSON.stringify(movement.rawSummary, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function MercadoPagoMovementBadge({
  children,
  tone
}: {
  children: ReactNode;
  tone: "ok" | "warn" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone === "ok" && "badge-success",
        tone === "warn" && "badge-warning",
        tone === "muted" && "badge-neutral"
      )}
    >
      {children}
    </span>
  );
}

function PaymentEntryRow({
  payment,
  label,
  onRemove
}: {
  payment: PaymentEntry;
  label: string;
  onRemove: () => void;
}) {
  if (payment.method === "MERCADOPAGO") {
    const status = mercadoPagoAttemptStatusLabel(payment.providerStatus ?? "");
    const detail = [
      payment.mercadoPagoOrigin ?? "QR API",
      payment.externalReference ? `Ref: ${shortReference(payment.externalReference)}` : null
    ]
      .filter(Boolean)
      .join(" - ");

    return (
      <div className="badge-success flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm shadow-sm dark:shadow-none">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">
            {label}
          </p>
          <p className="text-sm font-bold text-[var(--success)]">
            {formatARS(payment.amount)}
            {status ? (
              <span className="font-semibold text-[var(--text-secondary)]">
                {" "}- {status}
              </span>
            ) : null}
          </p>
          <p
            className="truncate text-xs text-[var(--text-secondary)]"
            title={paymentEntryDescription(payment)}
          >
            {detail || "Pago aplicado"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Quitar pago ${label}`}
          title="Quitar pago"
          onClick={onRemove}
        >
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <div className="app-panel-elevated flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm shadow-sm dark:shadow-none">
      <div className="min-w-0">
        <p className="font-medium text-[var(--text-primary)]">
          {label} {formatARS(payment.amount)}
        </p>
        <p
          className="truncate text-xs text-[var(--text-secondary)]"
          title={paymentEntryDescription(payment)}
        >
          {paymentEntryDescription(payment)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Quitar pago ${label}`}
        title="Quitar pago"
        onClick={onRemove}
      >
        Quitar
      </Button>
    </div>
  );
}

function PaymentMethodInfo({
  method,
  setting,
  disabled,
  copyFeedback,
  onCopy
}: {
  method: PaymentMethodValue;
  setting: PaymentMethodSettingView | undefined;
  disabled: boolean;
  copyFeedback: string | null;
  onCopy: (label: string, value: string | null | undefined) => void;
}) {
  if (!setting) {
    return null;
  }

  const hasAccountData = Boolean(
    setting.alias ||
      setting.cbu ||
      setting.cvu ||
      setting.accountHolder ||
      setting.bankName ||
      setting.qrImageDataUrl
  );
  const statusLabel = providerStatusLabel(setting.defaultProviderStatus);
  const shouldRender =
    hasAccountData ||
    setting.instructions ||
    statusLabel ||
    ["DEBIT", "CREDIT", "TRANSFER", "MERCADOPAGO", "CURRENT_ACCOUNT"].includes(method);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="app-panel-elevated space-y-3 rounded-lg p-3 text-sm shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            {setting.displayName}
          </p>
          {statusLabel ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Estado sugerido: {statusLabel}
            </p>
          ) : null}
        </div>
        {method === "MERCADOPAGO" && setting.qrImageDataUrl ? (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-[color:var(--panel-border)] bg-white p-1 dark:bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setting.qrImageDataUrl}
              alt="QR Mercado Pago"
              className="h-full w-full object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        {setting.bankName ? <PaymentDataLine label="Banco" value={setting.bankName} /> : null}
        {setting.accountHolder ? (
          <PaymentDataLine label="Titular" value={setting.accountHolder} />
        ) : null}
        {setting.alias ? (
          <PaymentCopyLine
            label="Alias"
            value={setting.alias}
            disabled={disabled}
            onCopy={onCopy}
          />
        ) : null}
        {setting.cvu ? (
          <PaymentCopyLine
            label="CVU"
            value={setting.cvu}
            disabled={disabled}
            onCopy={onCopy}
          />
        ) : null}
        {setting.cbu ? (
          <PaymentCopyLine
            label="CBU"
            value={setting.cbu}
            disabled={disabled}
            onCopy={onCopy}
          />
        ) : null}
        {setting.accountCuit ? (
          <PaymentDataLine label="CUIT" value={setting.accountCuit} />
        ) : null}
      </div>

      {setting.instructions ? (
        <p className="app-panel-secondary rounded-md px-3 py-2 text-xs text-[var(--text-secondary)]">
          {setting.instructions}
        </p>
      ) : null}
      {copyFeedback ? (
        <p className="text-xs font-medium text-[var(--primary)]">
          {copyFeedback}
        </p>
      ) : null}
    </div>
  );
}

function PaymentDataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-panel-secondary flex items-center justify-between gap-3 rounded-md px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-semibold text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function PaymentCopyLine({
  label,
  value,
  disabled,
  onCopy
}: {
  label: string;
  value: string;
  disabled: boolean;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="app-panel-secondary flex items-center justify-between gap-2 rounded-md px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </p>
        <p className="truncate font-semibold text-[var(--text-primary)]">{value}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onCopy(label, value)}
      >
        Copiar
      </Button>
    </div>
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
          "font-black uppercase tracking-[0.12em] text-[var(--text-primary)]",
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
              "group flex min-w-0 cursor-pointer flex-col rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg)] text-left shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-150 border-l-4 border-l-[color:var(--panel-border-strong)] hover:-translate-y-0.5 hover:border-[color:var(--primary)] hover:border-l-[color:var(--primary)] hover:bg-[var(--panel-bg-elevated)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] active:scale-[0.98] dark:shadow-none",
              compact ? "min-h-[92px] p-2" : "min-h-[116px] p-3",
              selectedIndex === index &&
                "border-[color:var(--primary)] bg-[var(--primary-soft)] border-l-[color:var(--primary)] ring-2 ring-[color:var(--panel-border-strong)]"
            )}
          >
            <span
              className={cn(
                "line-clamp-2 font-bold text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-primary)]",
                compact ? "min-h-8 text-xs" : "min-h-10 text-sm"
              )}
            >
              {product.name}
            </span>
            <span className={cn("mt-auto block truncate font-black text-[var(--text-primary)]", compact ? "pt-2 text-sm" : "pt-3 text-base")}>
              {formatARS(product.salePrice)}
            </span>
            <span className={cn("mt-1 block truncate text-[var(--text-secondary)]", compact ? "text-[11px]" : "text-xs")}>
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
        tone === "default" && "badge-warning",
        tone === "ok" && "badge-success",
        tone === "error" && "badge-danger"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base font-black 2xl:text-lg",
          tone === "default" && "text-[var(--warning)]",
          tone === "ok" && "text-[var(--success)]",
          tone === "error" && "text-[var(--danger)]"
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
    <div className="app-panel-elevated rounded-lg p-4 shadow-sm dark:shadow-none">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{hint}</p>
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

function mercadoPagoAttemptStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
    EXPIRED: "Vencido",
    ERROR: "Error"
  };

  return labels[status] ?? status;
}

function mercadoPagoEnvironmentLabel(environment: string) {
  return environment === "SANDBOX" ? "Sandbox" : "Produccion";
}

function mercadoPagoMovementStatusLabel(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  const labels: Record<string, string> = {
    approved: "Aprobado",
    accredited: "Acreditado",
    paid: "Aprobado",
    pending: "Pendiente",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Devuelto"
  };

  return labels[normalized] ?? String(status ?? "-");
}

function isMercadoPagoMovementApproved(movement: MercadoPagoMovementView) {
  return ["approved", "accredited", "paid"].includes(movement.status.toLowerCase());
}

function normalizeMercadoPagoPollSeconds(value: number | null | undefined) {
  return Math.max(15, Math.min(Math.trunc(value ?? 20), 300));
}

function isMercadoPagoMovementAmountMatch({
  movement,
  targetAmount,
  tolerance
}: {
  movement: MercadoPagoMovementView;
  targetAmount: number;
  tolerance: string | number;
}) {
  const amount = roundMoney(safeNumber(movement.amount));
  const target = roundMoney(targetAmount);
  const allowedDifference = Math.max(roundMoney(safeNumber(tolerance)), 0);

  return Math.abs(amount - target) <= allowedDifference + 0.001;
}

function isMercadoPagoExactAmountMatch(amount: string | number, targetAmount: number) {
  return roundMoney(safeNumber(amount)) === roundMoney(targetAmount);
}

function getMercadoPagoAttemptMessage(attempt: MercadoPagoAttemptView) {
  if (attempt.status === "APPROVED") {
    return "Pago aprobado y aplicado a la venta.";
  }
  if (attempt.status === "PENDING") {
    return "Esperando aprobacion del pago.";
  }
  if (attempt.status === "ERROR") {
    return attempt.rawStatusDetail ?? "Mercado Pago devolvio un error.";
  }

  return `Estado Mercado Pago: ${mercadoPagoAttemptStatusLabel(attempt.status)}.`;
}

function getMercadoPagoSidebarMessage(
  message: string | null,
  attempt: MercadoPagoAttemptView | null
) {
  if (!message) {
    return null;
  }

  if (attempt?.status === "APPROVED") {
    return null;
  }

  if (
    attempt?.status === "PENDING" &&
    (message.includes("Esperando aprobacion") ||
      message.includes("QR generado") ||
      message.includes("Consultando estado"))
  ) {
    return null;
  }

  return message;
}

function formatMercadoPagoDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function shouldAutofillPaymentAmount(method: PaymentMethodValue) {
  return ["MERCADOPAGO", "TRANSFER", "DEBIT", "CREDIT"].includes(method);
}

function shouldShowPaymentReference(
  method: PaymentMethodValue,
  setting: PaymentMethodSettingView | undefined
) {
  return (
    Boolean(setting?.askReference) &&
    ["MERCADOPAGO", "TRANSFER", "DEBIT", "CREDIT"].includes(method)
  );
}

function shortReference(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-5)}` : value;
}

function paymentEntryDescription(payment: PaymentEntry) {
  const details: string[] = [];

  if (payment.method === "CASH" && payment.receivedAmount) {
    details.push(`Recibido ${formatARS(payment.receivedAmount)}`);
  } else if (payment.method === "CREDIT" && payment.installments) {
    details.push(
      `${payment.installments} cuota${payment.installments > 1 ? "s" : ""}`
    );
  } else if (payment.method === "CURRENT_ACCOUNT" && payment.customerName) {
    details.push(payment.customerName);
  } else if (payment.method === "MERCADOPAGO" && payment.mercadoPagoAccountName) {
    details.push(payment.mercadoPagoAccountName);
  }

  if (payment.mercadoPagoOrigin) {
    details.push(payment.mercadoPagoOrigin);
  }

  if (payment.externalReference) {
    details.push(`Ref. ${shortReference(payment.externalReference)}`);
  }

  const status =
    payment.method === "MERCADOPAGO"
      ? mercadoPagoAttemptStatusLabel(payment.providerStatus ?? "")
      : providerStatusLabel(payment.providerStatus);
  if (status) {
    details.push(status);
  }

  return details.length > 0 ? details.join(" - ") : "Pago aplicado";
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
