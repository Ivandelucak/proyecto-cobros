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
import { AppAccordion, AppModal } from "@/components/ui/overlay";
import { PrintButton } from "@/components/ui/print-button";
import { useOfflineSales } from "@/components/offline/offline-sales-coordinator";
import { recordTicketPrintAction } from "@/app/(sales)/ventas/print-actions";
import { copyTextToClipboard } from "@/lib/clipboard";
import type {
  MercadoPagoAccountView,
  MercadoPagoAttemptView,
  MercadoPagoMovementView
} from "@/lib/mercadopago/mercado-pago-types";
import { formatARS } from "@/lib/money";
import {
  applyOfflineStockDecrease,
  enqueueOfflineSale,
  hasOfflineCashContext,
  isOfflineStorageAvailable,
  saveOfflineCashContext,
  saveOfflineCatalog
} from "@/lib/offline-sales/offline-db";
import { printOfflineTicket } from "@/lib/offline-sales/offline-ticket";
import {
  offlineContextId,
  type OfflineCashContext,
  type OfflineCashSale,
  type OfflineCatalogProduct
} from "@/lib/offline-sales/types";
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
  associateMercadoPagoRecentPaymentAction,
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
  isManual?: boolean;
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
  internalSaleNumber: string;
  totalAmount: number;
  paymentLabel: string;
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

type MercadoPagoApplyDialogState = {
  movement: MercadoPagoMovementView;
  accountName: string;
  targetAmount: number;
  paymentMethod: "MERCADOPAGO" | "TRANSFER";
  allowPartial: boolean;
};

type CashRegisterProps = {
  initialSuggestedProducts: CashProductResult[];
  offlineCatalog: OfflineCatalogProduct[];
  offlineContext: Omit<OfflineCashContext, "id" | "preparedAt"> | null;
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
const MERCADO_PAGO_SELECTED_ACCOUNT_STORAGE_KEY =
  "foxpoint.mercadopago.selectedAccountId";
const TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY =
  "foxpoint.transfer.selectedVerificationAccountId";
const TRANSFER_VERIFICATION_ENABLED_STORAGE_KEY =
  "foxpoint.transfer.verificationEnabled";
const TRANSFER_ALLOW_PARTIALS_STORAGE_KEY =
  "foxpoint.transfer.allowPartials";
const TRANSFER_SHOW_RECENT_MOVEMENTS_STORAGE_KEY =
  "foxpoint.transfer.showRecentMovements";
const TRANSFER_AMOUNT_TOLERANCE_STORAGE_KEY =
  "foxpoint.transfer.amountTolerance";
const TRANSFER_RECENT_RANGE_STORAGE_KEY =
  "foxpoint.transfer.recentRange";
const TRANSFER_RECENT_LIMIT_STORAGE_KEY =
  "foxpoint.transfer.recentLimit";
const TRANSFER_RECENT_REFRESH_STORAGE_KEY =
  "foxpoint.transfer.recentRefreshSeconds";
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
  offlineCatalog,
  offlineContext,
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
  const activeMercadoPagoAccounts = useMemo(
    () => mercadoPagoAccounts.filter((account) => account.enabled),
    [mercadoPagoAccounts]
  );
  const defaultMercadoPagoAccountId = getPreferredMercadoPagoAccountId(
    activeMercadoPagoAccounts,
    null
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CashProductResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [suggestedProducts, setSuggestedProducts] = useState(initialSuggestedProducts);
  const [offlineCatalogProducts, setOfflineCatalogProducts] =
    useState<OfflineCatalogProduct[]>(offlineCatalog);
  const [offlinePrepared, setOfflinePrepared] = useState(false);
  const [offlineReceipt, setOfflineReceipt] = useState<OfflineCashSale | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualItemName, setManualItemName] = useState("");
  const [manualItemPrice, setManualItemPrice] = useState("");
  const [manualItemQuantity, setManualItemQuantity] = useState("1");
  const [manualItemError, setManualItemError] = useState<string | null>(null);
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
  const [mercadoPagoLastMovementQueryAt, setMercadoPagoLastMovementQueryAt] =
    useState<string | null>(null);
  const [mercadoPagoMatchStartedAt, setMercadoPagoMatchStartedAt] =
    useState<number | null>(null);
  const [mercadoPagoMatchTimedOut, setMercadoPagoMatchTimedOut] = useState(false);
  const [mercadoPagoRecentRange, setMercadoPagoRecentRange] = useState("10");
  const [mercadoPagoRecentLimit, setMercadoPagoRecentLimit] = useState("5");
  const [mercadoPagoRecentRefreshSeconds, setMercadoPagoRecentRefreshSeconds] =
    useState("0");
  const [mercadoPagoApplyDialog, setMercadoPagoApplyDialog] =
    useState<MercadoPagoApplyDialogState | null>(null);
  const [transferVerificationAccountId, setTransferVerificationAccountId] =
    useState(defaultMercadoPagoAccountId);
  const [transferVerificationEnabled, setTransferVerificationEnabled] =
    useState(true);
  const [transferAllowPartialPayments, setTransferAllowPartialPayments] =
    useState(true);
  const [transferShowRecentMovements, setTransferShowRecentMovements] =
    useState(true);
  const [transferAmountTolerance, setTransferAmountTolerance] = useState("0");
  const [transferRecentRange, setTransferRecentRange] = useState("10");
  const [transferRecentLimit, setTransferRecentLimit] = useState("5");
  const [transferRecentRefreshSeconds, setTransferRecentRefreshSeconds] =
    useState("0");
  const [transferLastMovementQueryAt, setTransferLastMovementQueryAt] =
    useState<string | null>(null);
  const [movementModalContext, setMovementModalContext] =
    useState<"MERCADOPAGO" | "TRANSFER">("MERCADOPAGO");
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
  const mercadoPagoAccountSelectionLoadedRef = useRef(false);
  const transferVerificationSelectionLoadedRef = useRef(false);
  const mercadoPagoMatchSearchInFlightRef = useRef(false);
  const mercadoPagoLastMatchSearchAtRef = useRef(0);
  const {
    connection: offlineConnection,
    pendingCount: offlinePendingCount,
    refreshPendingCount: refreshOfflinePendingCount
  } = useOfflineSales();

  useEffect(() => {
    if (!offlineContext || !isOfflineStorageAvailable()) {
      return;
    }

    let active = true;
    const context: OfflineCashContext = {
      ...offlineContext,
      id: offlineContextId(
        offlineContext.businessId,
        offlineContext.userId,
        offlineContext.cashSessionId
      ),
      preparedAt: new Date().toISOString()
    };

    void Promise.all([
      saveOfflineCatalog(offlineContext.businessId, offlineCatalog),
      saveOfflineCashContext(context)
    ])
      .then(async () => {
        const [prepared] = await Promise.all([
          hasOfflineCashContext(context.id),
          refreshOfflinePendingCount()
        ]);
        if (active) {
          setOfflinePrepared(prepared && offlineCatalog.length > 0);
          setOfflineCatalogProducts(offlineCatalog);
        }
      })
      .catch(() => {
        if (active) {
          setOfflinePrepared(false);
        }
      });

    return () => {
      active = false;
    };
  }, [offlineCatalog, offlineContext, refreshOfflinePendingCount]);

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
  const displayTotal = saleSuccess?.totalAmount ?? total;
  const displayTotalPaid = saleSuccess ? saleSuccess.totalAmount : totalPaid;
  const displayRemaining = saleSuccess ? 0 : remaining;
  const displayOverpaid = saleSuccess ? 0 : overpaid;
  const paymentsMatch = cart.length > 0 && Math.abs(balance) < 0.01;
  const isOfflineCashMode = offlineConnection === "OFFLINE";
  const canOperateOffline =
    isOfflineCashMode && offlinePrepared && Boolean(offlineContext);
  const effectiveAllowNegativeStock = allowNegativeStock || canOperateOffline;
  const hasInvalidCart = cart.some((item) =>
    !isValidQuantity(item.quantity, item, effectiveAllowNegativeStock)
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
    !isOfflineCashMode &&
    selectedPaymentSetting?.mercadoPagoMode === "API_QR";
  const selectedMercadoPagoAccount =
    activeMercadoPagoAccounts.find((account) => account.id === mercadoPagoAccountId) ??
    activeMercadoPagoAccounts.find((account) => account.id === defaultMercadoPagoAccountId) ??
    null;
  const selectedTransferVerificationAccount =
    activeMercadoPagoAccounts.find(
      (account) => account.id === transferVerificationAccountId
    ) ??
    activeMercadoPagoAccounts.find((account) => account.id === defaultMercadoPagoAccountId) ??
    null;
  const isTransferPaymentMethod = paymentMethod === "TRANSFER" && !isOfflineCashMode;
  const movementModalAccount =
    movementModalContext === "TRANSFER"
      ? selectedTransferVerificationAccount
      : selectedMercadoPagoAccount;
  const movementModalRange =
    movementModalContext === "TRANSFER" ? transferRecentRange : mercadoPagoRecentRange;
  const movementModalLimit =
    movementModalContext === "TRANSFER" ? transferRecentLimit : mercadoPagoRecentLimit;
  const movementModalRefreshSeconds =
    movementModalContext === "TRANSFER"
      ? transferRecentRefreshSeconds
      : mercadoPagoRecentRefreshSeconds;
  const movementModalLastQueryAt =
    movementModalContext === "TRANSFER"
      ? transferLastMovementQueryAt
      : mercadoPagoLastMovementQueryAt;
  const movementModalAmountTolerance =
    movementModalContext === "TRANSFER"
      ? transferAmountTolerance
      : movementModalAccount?.amountMatchingTolerance ?? "0";
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
  const movementModalMatchCount = useMemo(
    () =>
      movementModalAccount
        ? mercadoPagoMovements.filter((movement) =>
            isMercadoPagoMovementAmountMatch({
              movement,
              targetAmount: remaining,
              tolerance: movementModalAmountTolerance
            })
          ).length
        : 0,
    [mercadoPagoMovements, movementModalAccount, movementModalAmountTolerance, remaining]
  );
  const showPaymentReference =
    !isMercadoPagoApiMode &&
    shouldShowPaymentReference(paymentMethod, selectedPaymentSetting);
  const mercadoPagoAttemptId = mercadoPagoAttempt?.id ?? null;
  const mercadoPagoAttemptStatus = mercadoPagoAttempt?.status ?? null;
  const canAutoSearchMercadoPagoMatches =
    isMercadoPagoApiMode &&
    Boolean(selectedMercadoPagoAccount?.enableAmountMatching) &&
    remaining > 0 &&
    !saleSuccess &&
    mercadoPagoAttemptStatus !== "PENDING" &&
    mercadoPagoAttemptStatus !== "APPROVED";
  const applyApprovedMercadoPagoAttempt = useCallback(
    (attempt: MercadoPagoAttemptView) => {
      const amount = roundMoney(safeNumber(attempt.amount));
      if (attempt.status !== "APPROVED" || amount <= 0) {
        return;
      }
      const method: PaymentMethodValue =
        attempt.method === "TRANSFER" ? "TRANSFER" : "MERCADOPAGO";

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
        const excess = amount > currentRemaining + 0.01;
        const appliedAmount = excess ? currentRemaining : amount;

        const nextRemaining = Math.max(roundMoney(currentRemaining - appliedAmount), 0);
        setMessage({
          text:
            nextRemaining <= 0.01
              ? `${
                  method === "TRANSFER" ? "Transferencia verificada" : "Pago"
                } aplicada. Finaliza la venta para registrarla.`
              : `${
                  method === "TRANSFER" ? "Transferencia verificada" : "Pago"
                } aplicada como parcial. Pendiente ${formatARS(nextRemaining)}.`,
          tone: "ok"
        });
        return [
          ...currentPayments,
          {
            id: createPaymentId(),
            method,
            amount: String(appliedAmount),
            receivedAmount: String(amount),
            externalId: attempt.providerPaymentId ?? attempt.externalReference,
            externalReference: attempt.externalReference,
            providerStatus:
              method === "TRANSFER" ? "VERIFIED_MERCADOPAGO" : "APPROVED",
            paymentAttemptId: attempt.id,
            mercadoPagoAccountName: attempt.accountName,
            mercadoPagoOrigin:
              method === "TRANSFER"
                ? "MANUAL_TRANSFER"
                : "MANUAL_RECENT_PAYMENT"
          }
        ];
      });
    },
    [total, setMessage]
  );

  useBarcodeScanner({
    enabled: !pendingFiscalPayments,
    preventDefaultOnScan: true,
    onScan: handleBarcodeScan
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!mercadoPagoAccountSelectionLoadedRef.current) {
        const storedAccountId = window.localStorage.getItem(
          MERCADO_PAGO_SELECTED_ACCOUNT_STORAGE_KEY
        );
        const preferredAccountId = getPreferredMercadoPagoAccountId(
          activeMercadoPagoAccounts,
          storedAccountId
        );
        mercadoPagoAccountSelectionLoadedRef.current = true;

        if (preferredAccountId && preferredAccountId !== mercadoPagoAccountId) {
          setMercadoPagoAccountId(preferredAccountId);
        }
        return;
      }

      if (!mercadoPagoAccountId) {
        return;
      }

      const stillActive = activeMercadoPagoAccounts.some(
        (account) => account.id === mercadoPagoAccountId
      );
      if (!stillActive) {
        const fallbackAccountId = getPreferredMercadoPagoAccountId(
          activeMercadoPagoAccounts,
          null
        );
        setMercadoPagoAccountId(fallbackAccountId);
        if (fallbackAccountId) {
          window.localStorage.setItem(
            MERCADO_PAGO_SELECTED_ACCOUNT_STORAGE_KEY,
            fallbackAccountId
          );
        }
        return;
      }

      window.localStorage.setItem(
        MERCADO_PAGO_SELECTED_ACCOUNT_STORAGE_KEY,
        mercadoPagoAccountId
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeMercadoPagoAccounts, mercadoPagoAccountId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!transferVerificationSelectionLoadedRef.current) {
        const storedAccountId = window.localStorage.getItem(
          TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY
        );
        const preferredAccountId = getPreferredMercadoPagoAccountId(
          activeMercadoPagoAccounts,
          storedAccountId
        );
        const storedEnabled = window.localStorage.getItem(
          TRANSFER_VERIFICATION_ENABLED_STORAGE_KEY
        );
        const storedAllowPartials = window.localStorage.getItem(
          TRANSFER_ALLOW_PARTIALS_STORAGE_KEY
        );
        const storedShowRecentMovements = window.localStorage.getItem(
          TRANSFER_SHOW_RECENT_MOVEMENTS_STORAGE_KEY
        );
        const storedAmountTolerance = window.localStorage.getItem(
          TRANSFER_AMOUNT_TOLERANCE_STORAGE_KEY
        );
        const storedRange = window.localStorage.getItem(
          TRANSFER_RECENT_RANGE_STORAGE_KEY
        );
        const storedLimit = window.localStorage.getItem(
          TRANSFER_RECENT_LIMIT_STORAGE_KEY
        );
        const storedRefresh = window.localStorage.getItem(
          TRANSFER_RECENT_REFRESH_STORAGE_KEY
        );

        transferVerificationSelectionLoadedRef.current = true;

        setTransferVerificationEnabled(storedEnabled !== "false");
        setTransferAllowPartialPayments(storedAllowPartials !== "false");
        setTransferShowRecentMovements(storedShowRecentMovements !== "false");
        if (storedAmountTolerance && safeNumber(storedAmountTolerance) >= 0) {
          setTransferAmountTolerance(sanitizeMoneyInput(storedAmountTolerance));
        }
        if (isValidRecentRangeValue(storedRange)) {
          setTransferRecentRange(storedRange);
        }
        if (isValidRecentLimitValue(storedLimit)) {
          setTransferRecentLimit(storedLimit);
        }
        if (isValidRecentRefreshValue(storedRefresh)) {
          setTransferRecentRefreshSeconds(storedRefresh);
        }
        if (preferredAccountId && preferredAccountId !== transferVerificationAccountId) {
          setTransferVerificationAccountId(preferredAccountId);
        }
        return;
      }

      if (transferVerificationAccountId) {
        const stillActive = activeMercadoPagoAccounts.some(
          (account) => account.id === transferVerificationAccountId
        );
        if (!stillActive) {
          const fallbackAccountId = getPreferredMercadoPagoAccountId(
            activeMercadoPagoAccounts,
            null
          );
          setTransferVerificationAccountId(fallbackAccountId);
          if (fallbackAccountId) {
            window.localStorage.setItem(
              TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY,
              fallbackAccountId
            );
          }
          return;
        }
      }

      window.localStorage.setItem(
        TRANSFER_VERIFICATION_ENABLED_STORAGE_KEY,
        String(transferVerificationEnabled)
      );
      window.localStorage.setItem(
        TRANSFER_ALLOW_PARTIALS_STORAGE_KEY,
        String(transferAllowPartialPayments)
      );
      window.localStorage.setItem(
        TRANSFER_SHOW_RECENT_MOVEMENTS_STORAGE_KEY,
        String(transferShowRecentMovements)
      );
      window.localStorage.setItem(
        TRANSFER_AMOUNT_TOLERANCE_STORAGE_KEY,
        transferAmountTolerance
      );
      window.localStorage.setItem(
        TRANSFER_RECENT_RANGE_STORAGE_KEY,
        transferRecentRange
      );
      window.localStorage.setItem(
        TRANSFER_RECENT_LIMIT_STORAGE_KEY,
        transferRecentLimit
      );
      window.localStorage.setItem(
        TRANSFER_RECENT_REFRESH_STORAGE_KEY,
        transferRecentRefreshSeconds
      );
      if (transferVerificationAccountId) {
        window.localStorage.setItem(
          TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY,
          transferVerificationAccountId
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    activeMercadoPagoAccounts,
    transferAllowPartialPayments,
    transferAmountTolerance,
    transferRecentLimit,
    transferRecentRange,
    transferRecentRefreshSeconds,
    transferShowRecentMovements,
    transferVerificationAccountId,
    transferVerificationEnabled
  ]);

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
    const timer = window.setTimeout(() => {
      if (!canAutoSearchMercadoPagoMatches) {
        setMercadoPagoMatchPollingEnabled(false);
        setMercadoPagoMatchStartedAt(null);
        setMercadoPagoMatchTimedOut(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canAutoSearchMercadoPagoMatches]);

  useEffect(() => {
    if (
      !canAutoSearchMercadoPagoMatches ||
      !mercadoPagoMatchPollingEnabled ||
      mercadoPagoMatchTimedOut
    ) {
      return;
    }

    let cancelled = false;
    const startedAt = mercadoPagoMatchStartedAt ?? Date.now();
    const timeoutMs = 5 * 60 * 1000;
    const account = selectedMercadoPagoAccount;
    if (!account) {
      return;
    }

    const runSearch = () => {
      if (mercadoPagoMatchSearchInFlightRef.current) {
        return;
      }

      const now = Date.now();
      if (now - startedAt > timeoutMs) {
        setMercadoPagoMatchPollingEnabled(false);
        setMercadoPagoMatchTimedOut(true);
        setMercadoPagoMessage(
          "Busqueda pausada despues de 5 minutos. Podes seguir buscando manualmente."
        );
        return;
      }

      if (now - mercadoPagoLastMatchSearchAtRef.current < 5000) {
        setMercadoPagoMessage(
          "La busqueda se pauso para evitar consultas repetidas. Reintenta en unos segundos."
        );
        return;
      }

      mercadoPagoMatchSearchInFlightRef.current = true;
      mercadoPagoLastMatchSearchAtRef.current = now;
      setMercadoPagoLastMovementQueryAt(new Date(now).toISOString());
      setMercadoPagoMessage(
        `Buscando cobros cada ${mercadoPagoPollSeconds}s...`
      );

      startTransition(async () => {
        const result = await findMercadoPagoAmountMatchesAction({
          accountId: account.id,
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
        setMercadoPagoLastMovementQueryAt(new Date().toISOString());
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
          account.amountMatchingAutoApprove &&
          isMercadoPagoMovementApproved(candidate) &&
          !candidate.alreadyUsed &&
          isMercadoPagoExactAmountMatch(candidate.amount, remaining)
        ) {
          const associateResult = await associateMercadoPagoPaymentAction({
            accountId: account.id,
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

          setMercadoPagoMatchStartedAt(null);
          setMercadoPagoMatchTimedOut(false);
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
    canAutoSearchMercadoPagoMatches,
    mercadoPagoMatchStartedAt,
    mercadoPagoMatchPollingEnabled,
    mercadoPagoMatchTimedOut,
    mercadoPagoPollSeconds,
    remaining,
    selectedMercadoPagoAccount,
    selectedMercadoPagoAccount?.amountMatchingAutoApprove,
    selectedMercadoPagoAccount?.id,
    startTransition
  ]);

  function showMessage(text: string, tone: "ok" | "error") {
    setMessage({ text, tone });
  }

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

    if (isOfflineCashMode) {
      const normalizedSearch = search.toLowerCase();
      const offlineResults = offlineCatalogProducts.filter((product) =>
        [product.name, product.barcode, product.sku, product.categoryName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch))
      );
      const exactProduct = offlineResults.find(
        (product) =>
          product.barcode?.toLowerCase() === normalizedSearch ||
          product.sku?.toLowerCase() === normalizedSearch
      );
      if (exactProduct) {
        addProduct(exactProduct);
        return;
      }
      setResults(offlineResults);
      setSelectedResultIndex(0);
      if (offlineResults.length === 0) {
        showMessage("No se encontraron productos en el catalogo local.", "error");
      }
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
    if (isOfflineCashMode) {
      const product = offlineCatalogProducts.find(
        (candidate) =>
          candidate.barcode?.toLowerCase() === code.trim().toLowerCase() ||
          candidate.sku?.toLowerCase() === code.trim().toLowerCase()
      );
      if (product && addProduct(product)) {
        setBarcodeMessage({
          code,
          message: `Producto encontrado en catalogo local: ${product.name}.`,
          tone: "ok"
        });
      } else {
        const message = "No se encontro producto en el catalogo local.";
        setBarcodeMessage({ code, message, tone: "error" });
        showMessage(message, "error");
      }
      return;
    }
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
      if (!effectiveAllowNegativeStock && safeNumber(nextQuantity) > safeNumber(product.stock)) {
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

    if (!effectiveAllowNegativeStock && nextQuantity > safeNumber(item.stock)) {
      showMessage(`Stock insuficiente para ${item.name}.`, "error");
      return;
    }

    updateQuantity(item.id, String(nextQuantity));
  }

  function removeItem(productId: string) {
    setSaleSuccess(null);
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  }

  function handleAddManualItem(event: any) {
    event.preventDefault();
    setManualItemError(null);

    const name = manualItemName.trim();
    if (name.length < 2) {
      setManualItemError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    if (name.length > 80) {
      setManualItemError("El nombre no puede superar los 80 caracteres.");
      return;
    }

    const priceNum = safeNumber(manualItemPrice.replace(",", "."));
    if (isNaN(priceNum) || priceNum <= 0) {
      setManualItemError("El precio unitario debe ser mayor a cero.");
      return;
    }

    const qtyNum = safeNumber(manualItemQuantity.replace(",", "."));
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setManualItemError("La cantidad debe ser mayor a cero.");
      return;
    }

    const newItem = createManualCartItem(name, String(priceNum), String(qtyNum));
    setCart((currentCart) => [...currentCart, newItem]);

    setManualItemName("");
    setManualItemPrice("");
    setManualItemQuantity("1");
    setIsManualModalOpen(false);

    showMessage(`Artículo manual "${name}" agregado.`, "ok");
  }

  function addPayment() {
    setSaleSuccess(null);

    if (isOfflineCashMode) {
      showMessage("Sin conexion solo se permite finalizar una venta completa en efectivo.", "error");
      return;
    }

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

  function searchMercadoPagoMovements(options?: {
    openModal?: boolean;
    message?: string;
  }) {
    if (!selectedMercadoPagoAccount) {
      showMessage("Selecciona una cuenta Mercado Pago.", "error");
      return;
    }

    setMovementModalContext("MERCADOPAGO");
    setMercadoPagoMatchTimedOut(false);
    if (options?.openModal ?? true) {
      setMercadoPagoMovementsModalOpen(true);
    }
    setMercadoPagoMessage(options?.message ?? "Buscando cobros recientes Mercado Pago...");
    setMercadoPagoTechnicalDetail(null);
    setMercadoPagoLastMovementQueryAt(new Date().toISOString());
    startTransition(async () => {
      const result = await searchRecentMercadoPagoPaymentsAction({
        accountId: selectedMercadoPagoAccount.id,
        minutes: resolveMercadoPagoRecentRangeMinutes(mercadoPagoRecentRange),
        limit: normalizeMercadoPagoRecentLimit(mercadoPagoRecentLimit)
      });
      if (!result.ok) {
        setMercadoPagoMessage(
          result.error ?? "No se pudieron consultar cobros recientes."
        );
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        return;
      }
      setMercadoPagoMovements(result.movements);
      setMercadoPagoLastMovementQueryAt(new Date().toISOString());
      setMercadoPagoTechnicalDetail(null);
      setMercadoPagoMessage(
        result.movements.length > 0
          ? "Cobros recientes actualizados."
          : "Mercado Pago no devolvio cobros para esta cuenta."
      );
    });
  }

  function highlightMercadoPagoMatches() {
    if (!selectedMercadoPagoAccount) {
      showMessage("Selecciona una cuenta Mercado Pago.", "error");
      return;
    }
    if (remaining <= 0) {
      showMessage("No hay saldo pendiente para matchear.", "error");
      return;
    }

    searchMercadoPagoMovements({
      openModal: true,
      message: "Actualizando cobros para resaltar coincidencias..."
    });
  }

  function searchTransferMovements(options?: {
    openModal?: boolean;
    message?: string;
  }) {
    if (!transferVerificationEnabled) {
      showMessage("La verificacion automatica de transferencias esta desactivada.", "error");
      return;
    }
    if (!transferShowRecentMovements) {
      showMessage("Los movimientos recientes de transferencia estan ocultos en caja.", "error");
      return;
    }
    if (!selectedTransferVerificationAccount) {
      showMessage("Selecciona una cuenta Mercado Pago para verificar transferencias.", "error");
      return;
    }

    setMovementModalContext("TRANSFER");
    if (options?.openModal ?? true) {
      setMercadoPagoMovementsModalOpen(true);
    }
    setMercadoPagoMessage(
      options?.message ?? "Buscando transferencias recientes en Mercado Pago..."
    );
    setMercadoPagoTechnicalDetail(null);
    setTransferLastMovementQueryAt(new Date().toISOString());
    startTransition(async () => {
      const result = await searchRecentMercadoPagoPaymentsAction({
        accountId: selectedTransferVerificationAccount.id,
        minutes: resolveMercadoPagoRecentRangeMinutes(transferRecentRange),
        limit: normalizeMercadoPagoRecentLimit(transferRecentLimit)
      });
      if (!result.ok) {
        setMercadoPagoMessage(
          result.error ?? "No se pudieron consultar transferencias recientes."
        );
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        return;
      }
      setMercadoPagoMovements(result.movements);
      setTransferLastMovementQueryAt(new Date().toISOString());
      setMercadoPagoTechnicalDetail(null);
      setMercadoPagoMessage(
        result.movements.length > 0
          ? "Transferencias recientes actualizadas."
          : "Mercado Pago no devolvio movimientos recientes para esta cuenta."
      );
    });
  }

  function highlightTransferMatches() {
    if (!selectedTransferVerificationAccount) {
      showMessage("Selecciona una cuenta Mercado Pago para verificar transferencias.", "error");
      return;
    }
    if (remaining <= 0) {
      showMessage("No hay saldo pendiente para matchear.", "error");
      return;
    }

    searchTransferMovements({
      openModal: true,
      message: "Actualizando transferencias para resaltar coincidencias..."
    });
  }

  useEffect(() => {
    const seconds = Number(mercadoPagoRecentRefreshSeconds);
    const accountId = selectedMercadoPagoAccount?.id;
    if (
      !mercadoPagoMovementsModalOpen ||
      seconds <= 0 ||
      !isMercadoPagoApiMode ||
      !accountId
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      setMercadoPagoLastMovementQueryAt(new Date().toISOString());
      startTransition(async () => {
        const result = await searchRecentMercadoPagoPaymentsAction({
          accountId,
          minutes: resolveMercadoPagoRecentRangeMinutes(mercadoPagoRecentRange),
          limit: normalizeMercadoPagoRecentLimit(mercadoPagoRecentLimit)
        });
        if (!result.ok) {
          setMercadoPagoMessage(
            result.error ?? "No se pudieron consultar cobros recientes."
          );
          setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
          return;
        }

        setMercadoPagoMovements(result.movements);
        setMercadoPagoLastMovementQueryAt(new Date().toISOString());
        setMercadoPagoTechnicalDetail(null);
        setMercadoPagoMessage(
          result.movements.length > 0
            ? "Cobros recientes actualizados."
            : "Mercado Pago no devolvio cobros para esta cuenta."
        );
      });
    }, seconds * 1000);

    return () => window.clearInterval(timer);
  }, [
    isMercadoPagoApiMode,
    mercadoPagoMovementsModalOpen,
    mercadoPagoRecentRefreshSeconds,
    mercadoPagoRecentLimit,
    mercadoPagoRecentRange,
    selectedMercadoPagoAccount?.id,
    startTransition
  ]);

  useEffect(() => {
    const seconds = Number(transferRecentRefreshSeconds);
    const accountId = selectedTransferVerificationAccount?.id;
    if (
      !mercadoPagoMovementsModalOpen ||
      movementModalContext !== "TRANSFER" ||
      seconds <= 0 ||
      !transferVerificationEnabled ||
      !transferShowRecentMovements ||
      !accountId
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      setTransferLastMovementQueryAt(new Date().toISOString());
      startTransition(async () => {
        const result = await searchRecentMercadoPagoPaymentsAction({
          accountId,
          minutes: resolveMercadoPagoRecentRangeMinutes(transferRecentRange),
          limit: normalizeMercadoPagoRecentLimit(transferRecentLimit)
        });
        if (!result.ok) {
          setMercadoPagoMessage(
            result.error ?? "No se pudieron consultar transferencias recientes."
          );
          setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
          return;
        }

        setMercadoPagoMovements(result.movements);
        setTransferLastMovementQueryAt(new Date().toISOString());
        setMercadoPagoTechnicalDetail(null);
        setMercadoPagoMessage(
          result.movements.length > 0
            ? "Transferencias recientes actualizadas."
            : "Mercado Pago no devolvio movimientos recientes para esta cuenta."
        );
      });
    }, seconds * 1000);

    return () => window.clearInterval(timer);
  }, [
    mercadoPagoMovementsModalOpen,
    movementModalContext,
    selectedTransferVerificationAccount?.id,
    startTransition,
    transferRecentLimit,
    transferRecentRange,
    transferRecentRefreshSeconds,
    transferShowRecentMovements,
    transferVerificationEnabled
  ]);

  function performMovementAssociation(
    movement: MercadoPagoMovementView,
    selectedAccount: any,
    paymentMethod: "MERCADOPAGO" | "TRANSFER"
  ) {
    setMercadoPagoMatchPollingEnabled(false);
    setMercadoPagoMatchStartedAt(null);
    setMercadoPagoMatchTimedOut(false);
    setMercadoPagoTechnicalDetail(null);

    startTransition(async () => {
      const result = await associateMercadoPagoRecentPaymentAction({
        accountId: selectedAccount.id,
        paymentId: movement.id,
        paymentMethod
      });
      if (!result.ok || !result.attempt) {
        setMercadoPagoMessage(result.error ?? "No se pudo asociar el pago.");
        setMercadoPagoTechnicalDetail(result.technicalDetail ?? null);
        return;
      }
      setMercadoPagoAttempt(result.attempt);
      setMercadoPagoApplyDialog(null);
      setMercadoPagoMovementsModalOpen(false);
      setMercadoPagoMessage(
        paymentMethod === "TRANSFER"
          ? "Transferencia verificada aplicada. Finaliza la venta para registrarla."
          : "Cobro aplicado. Finaliza la venta para registrarla."
      );
      setMercadoPagoTechnicalDetail(null);
      applyApprovedMercadoPagoAttempt(result.attempt);
    });
  }

  function associateMercadoPagoMovement(
    movement: MercadoPagoMovementView
  ) {
    const paymentMethod =
      movementModalContext === "TRANSFER" ? "TRANSFER" : "MERCADOPAGO";
    const account =
      paymentMethod === "TRANSFER"
        ? selectedTransferVerificationAccount
        : selectedMercadoPagoAccount;
    const allowPartial =
      paymentMethod === "TRANSFER" ? transferAllowPartialPayments : true;

    if (!account) {
      return;
    }

    if (payments.some((payment) => payment.externalId === movement.id)) {
      setMercadoPagoMessage("Este cobro ya fue aplicado a la venta actual.");
      setMercadoPagoTechnicalDetail(null);
      return;
    }
    if (movement.alreadyUsed) {
      setMercadoPagoMessage(
        movement.usedSaleNumber
          ? `Este cobro ya fue usado en la venta #${movement.usedSaleNumber}.`
          : "Este cobro ya fue usado en otra venta."
      );
      setMercadoPagoTechnicalDetail(null);
      return;
    }
    if (!isMercadoPagoMovementApproved(movement)) {
      setMercadoPagoMessage("Solo se pueden aplicar cobros aprobados.");
      setMercadoPagoTechnicalDetail(null);
      return;
    }

    const targetAmount = roundMoney(remaining);
    const exactMatch = isMercadoPagoExactAmountMatch(movement.amount, targetAmount);

    if (exactMatch) {
      performMovementAssociation(movement, account, paymentMethod);
    } else {
      setMercadoPagoApplyDialog({
        movement,
        accountName: account.name,
        targetAmount: remaining,
        paymentMethod,
        allowPartial
      });
    }
  }

  function confirmMercadoPagoMovementAssociation() {
    if (!mercadoPagoApplyDialog) {
      return;
    }

    const movement = mercadoPagoApplyDialog.movement;
    const selectedAccount =
      mercadoPagoApplyDialog.paymentMethod === "TRANSFER"
        ? selectedTransferVerificationAccount
        : selectedMercadoPagoAccount;
    if (!selectedAccount) {
      return;
    }

    performMovementAssociation(movement, selectedAccount, mercadoPagoApplyDialog.paymentMethod);
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
    setMercadoPagoApplyDialog(null);
    setMercadoPagoMatchPollingEnabled(false);

    setMercadoPagoMatchStartedAt(null);
    setMercadoPagoMatchTimedOut(false);
    setMercadoPagoLastMovementQueryAt(null);
    setSaleSuccess(null);
    clearSearch();
    inputRef.current?.focus();
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setSelectedResultIndex(0);
  }

  async function finishSale() {
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

    if (isOfflineCashMode) {
      await saveOfflineCashSale();
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

  async function saveOfflineCashSale() {
    if (!canOperateOffline || !offlineContext) {
      showMessage(
        "No es posible operar sin conexion porque la sesion no fue preparada previamente.",
        "error"
      );
      return;
    }

    if (paymentMethod !== "CASH" || payments.length > 0) {
      showMessage(
        "Sin conexion solo se permiten ventas nuevas cobradas integramente en efectivo.",
        "error"
      );
      return;
    }

    const received = roundMoney(safeNumber(cashReceived));
    if (received < total) {
      showMessage("Ingresa el efectivo recibido para completar la venta offline.", "error");
      return;
    }

    const occurredAt = new Date().toISOString();
    const operationId = createOfflineOperationId();
    const offlineSale: OfflineCashSale = {
      clientOperationId: operationId,
      businessId: offlineContext.businessId,
      userId: offlineContext.userId,
      cashSessionId: offlineContext.cashSessionId,
      occurredAt,
      total: roundMoney(total).toFixed(2),
      cashReceived: received.toFixed(2),
      changeAmount: roundMoney(received - total).toFixed(2),
      items: cart.map((item) => {
        const quantity = safeNumber(item.quantity);
        const unitPrice = safeNumber(item.salePrice);
        return {
          productId: item.isManual ? null : item.id,
          isManual: Boolean(item.isManual),
          nameSnapshot: item.name,
          unitPriceSnapshot: roundMoney(unitPrice).toFixed(2),
          quantity: String(roundQuantity(quantity)),
          subtotal: roundMoney(unitPrice * quantity).toFixed(2),
          unitTypeSnapshot: item.unitType,
          allowsDecimalQuantity: item.allowsDecimalQuantity
        };
      }),
      status: "PENDING",
      retryCount: 0,
      lastError: null,
      lastAttemptAt: null,
      syncedSaleId: null,
      syncedSaleNumber: null,
      offlineNumber: `OFF-${operationId.slice(-6).toUpperCase()}`
    };

    try {
      await enqueueOfflineSale(offlineSale);
      await Promise.all(
        offlineSale.items
          .filter((item): item is typeof item & { productId: string } => Boolean(item.productId))
          .map((item) =>
            applyOfflineStockDecrease(
              offlineContext.businessId,
              item.productId,
              item.quantity
            )
          )
      );
      setOfflineCatalogProducts((products) =>
        products.map((product) => {
          const item = offlineSale.items.find((candidate) => candidate.productId === product.id);
          return item
            ? { ...product, stock: String(roundQuantity(safeNumber(product.stock) - safeNumber(item.quantity))) }
            : product;
        })
      );
      setSuggestedProducts((products) =>
        products.map((product) => {
          const item = offlineSale.items.find((candidate) => candidate.productId === product.id);
          return item
            ? { ...product, stock: String(roundQuantity(safeNumber(product.stock) - safeNumber(item.quantity))) }
            : product;
        })
      );
      setOfflineReceipt(offlineSale);
      setCart([]);
      setPayments([]);
      setCashReceived("");
      setPaymentAmount("");
      setMessage({
        text: "Venta guardada en este equipo. Se sincronizara automaticamente.",
        tone: "ok"
      });
      await refreshOfflinePendingCount();
      clearSearch();
      inputRef.current?.focus();
    } catch {
      showMessage("No se pudo guardar la venta en este equipo. No se confirmo la venta.", "error");
    }
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
          productId: item.isManual ? null : item.id,
          quantity: item.quantity,
          isManual: item.isManual || false,
          name: item.isManual ? item.name : undefined,
          unitPrice: item.isManual ? item.salePrice : undefined
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
        internalSaleNumber: result.internalSaleNumber ?? "",
        fiscalStatus: result.fiscalStatus,
        requiresFiscalInvoice: result.requiresFiscalInvoice
      };
      setSaleSuccess({
        saleId: confirmedSale.saleId,
        internalSaleNumber: confirmedSale.internalSaleNumber,
        totalAmount: roundMoney(
          finalPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0)
        ),
        paymentLabel: formatSalePaymentSummary(finalPayments, paymentLabels),
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
      setMercadoPagoApplyDialog(null);
      setMercadoPagoMatchPollingEnabled(false);

      setMercadoPagoMatchStartedAt(null);
      setMercadoPagoMatchTimedOut(false);
      setMercadoPagoLastMovementQueryAt(null);
      clearSearch();
      if (result.suggestedProducts) {
        setSuggestedProducts(result.suggestedProducts);
      }
      inputRef.current?.focus();
      void maybeAutoPrintTicket(confirmedSale.saleId);
    });
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
      className="cash-register-screen grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_clamp(300px,24vw,380px)]"
      onKeyDown={handlePanelKeyDown}
    >
      <div className="cash-main-column grid min-h-0 min-w-0 gap-2.5 2xl:gap-3">
        <Card className="cash-search-card pos-accent-line min-h-0 overflow-y-auto p-2.5 pl-4 shadow-lg shadow-[#5B6B79]/10 ring-1 ring-white/70 dark:shadow-none dark:ring-0 2xl:p-3 2xl:pl-5">
          <form
            className="input-base flex flex-col gap-2 rounded-lg p-1.5 shadow-inner shadow-[#5B6B79]/10 dark:shadow-none sm:flex-row sm:gap-2"
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
              className="cash-search-input h-10 border-transparent bg-transparent text-sm font-semibold shadow-none focus:border-transparent focus:ring-0 dark:bg-transparent dark:text-[#F3F7FA] dark:placeholder:text-[#7F8D9A] dark:shadow-none 2xl:h-11 2xl:text-base"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || query.trim().length === 0}
              className="h-10 shrink-0 px-5 2xl:h-11 2xl:px-6"
            >
              Buscar
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="btn-secondary h-10 shrink-0 px-4 2xl:h-11 2xl:px-5"
              onClick={() => setIsManualModalOpen(true)}
            >
              Ítem manual
            </Button>
          </form>

          <div className="cash-shortcuts mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--text-secondary)]">
            <Badge tone="blue">F1 Buscar</Badge>
            <Badge tone="green">Enter Agregar</Badge>
            <Badge tone="amber">F4 Cobrar</Badge>
            <Badge tone="neutral">Esc Limpiar</Badge>
          </div>

          {isOfflineCashMode ? (
            <div className="badge-warning mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs">
              <span className="font-bold">
                Sin conexion. Solo estan habilitadas las ventas en efectivo.
              </span>
              <span>
                Ventas pendientes: {offlinePendingCount}. No cierres ni actualices Fox Point.
              </span>
            </div>
          ) : offlinePendingCount > 0 ? (
            <div className="badge-info mt-2 rounded-lg px-3 py-2 text-xs font-semibold">
              Ventas pendientes de sincronizacion: {offlinePendingCount}.
            </div>
          ) : null}

          <div className="mt-2">
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
              offlineStock={isOfflineCashMode}
              selectedIndex={selectedResultIndex}
              onAddProduct={addProduct}
            />
          ) : (
            <ProductGrid
              title="Productos rapidos"
              products={suggestedProducts}
              compact={compactProducts}
              offlineStock={isOfflineCashMode}
              onAddProduct={addProduct}
            />
          )}
        </Card>

        <Card className="cash-cart-card min-h-0 overflow-hidden shadow-lg shadow-[#5B6B79]/10 dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="cash-cart-table w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Producto</th>
                  <th className="px-3 py-2.5 font-semibold">Cantidad</th>
                  <th className="px-3 py-2.5 font-semibold">Precio</th>
                  <th className="px-3 py-2.5 font-semibold">Subtotal</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)]">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="cash-cart-empty px-3 py-8 text-center text-sm text-[var(--text-muted)]">
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
                      effectiveAllowNegativeStock
                    );
                    const stockExceeded =
                      !effectiveAllowNegativeStock && quantity > safeNumber(item.stock);

                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-[var(--panel-bg-elevated)]"
                      >
                        <td className="px-3 py-2.5">
                          <div className="text-[15px] font-black leading-tight text-[var(--text-primary)] 2xl:text-base">
                            {item.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                            {item.isManual ? (
                              <span className="font-bold text-[color:var(--primary)] uppercase tracking-wider text-[10px]">
                                Artículo manual
                              </span>
                            ) : (
                              `${item.categoryName} - ${formatStock(item.stock, item.unitType)}${isOfflineCashMode ? " (estimado)" : ""}`
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
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
                              className="h-8 w-20 text-center font-semibold"
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
                        <td className="px-3 py-2.5 text-[15px] font-bold text-[var(--text-secondary)]">{formatARS(item.salePrice)}</td>
                        <td className="px-3 py-2.5 text-base font-black text-[var(--text-primary)]">
                          {formatARS(subtotalItem)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="btn-danger inline-flex h-8 w-9 items-center justify-center rounded-md border shadow-sm transition-colors duration-150 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--danger)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1015]"
                            aria-label="Quitar producto"
                            title="Quitar producto"
                            onClick={() => removeItem(item.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
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

      <aside className="cash-sidebar min-w-0 space-y-2.5 xl:sticky xl:top-3 xl:self-start 2xl:space-y-3">
        <Card className="cash-console border-t-4 border-t-[color:var(--primary)] p-3 2xl:p-4">
          <div className="cash-console-header flex-none">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              Consola de cobro
            </p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Total final
            </p>
            <p className="cash-total mt-0.5 text-[2.55rem] font-black leading-none tracking-tight text-[var(--text-primary)] 2xl:text-5xl">
              {formatARS(displayTotal)}
            </p>
            {surchargeAmount > 0 ? (
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                Subtotal {formatARS(subtotal)} - Recargo {formatARS(surchargeAmount)}
              </p>
            ) : null}
          </div>

          <div className="cash-summary-grid mt-3 grid grid-cols-2 gap-2 text-sm">
            <SummaryValue label="Pagado" value={formatARS(displayTotalPaid)} tone="ok" />
            <SummaryValue
              label={displayOverpaid > 0 ? "Excedente" : "Pendiente"}
              value={formatARS(displayOverpaid > 0 ? displayOverpaid : displayRemaining)}
              tone={displayOverpaid > 0 ? "error" : displayRemaining === 0 ? "ok" : "default"}
            />
          </div>

          <div
            className={cn(
              "cash-status-strip mt-3 rounded-lg border px-3 py-2 text-center text-sm font-bold transition-colors duration-150",
              saleSuccess
                ? "badge-success"
                : paymentsDisabled
                ? "badge-neutral"
                : remaining === 0 && overpaid === 0
                  ? "badge-success"
                  : overpaid > 0
                    ? "badge-danger"
                    : "badge-warning"
            )}
          >
            {saleSuccess
              ? `Venta #${saleSuccess.internalSaleNumber} lista`
              : paymentsDisabled
              ? "Agrega productos para cargar pagos."
              : overpaid > 0
                ? `Excedente ${formatARS(overpaid)}`
                : remaining === 0
                  ? "Pago completo"
                  : `Pendiente ${formatARS(remaining)}`}
          </div>

          <p className="cash-payment-hint app-panel-elevated mt-2 rounded-lg px-3 py-1.5 text-xs leading-5 text-[var(--text-secondary)]">
            {saleSuccess
              ? "Venta confirmada. Nueva venta para continuar."
              : paymentsDisabled
              ? "Agrega productos para elegir el medio de pago."
              : payments.length === 0
                ? `Se cobrara el total con ${paymentLabels[paymentMethod]}.`
                : paymentsMatch
                  ? "Pago completo con los pagos cargados."
                  : `Pagos parciales cargados. Pendiente ${formatARS(remaining)}.`}
          </p>
          </div>

          <div className="cash-console-body min-h-0 flex-1 overflow-y-auto pr-1">
          {!saleSuccess && !(paymentsMatch && payments.length > 0) ? (
          <div className={cn("cash-payment-stack mt-3 space-y-3", paymentsDisabled && "opacity-75")}>
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
                  setMercadoPagoApplyDialog(null);
                  setMercadoPagoMatchPollingEnabled(false);

                  setMercadoPagoMatchStartedAt(null);
                  setMercadoPagoMatchTimedOut(false);
                  setMercadoPagoLastMovementQueryAt(null);
                  setTransferLastMovementQueryAt(null);
                  setMovementModalContext(
                    nextMethod === "TRANSFER" ? "TRANSFER" : "MERCADOPAGO"
                  );
                  if (nextMethod !== "CURRENT_ACCOUNT") {
                    setCustomerResults([]);
                    setSelectedCustomer(null);
                    setCustomerQuery("");
                  }
                }}
              >
                {paymentMethods.map((method) => (
                  <option
                    key={method.method}
                    value={method.method}
                    disabled={isOfflineCashMode && method.method !== "CASH"}
                  >
                    {method.label}
                  </option>
                ))}
              </Select>
            </label>

            {isMercadoPagoApiMode ? (
              <MercadoPagoApiPanel
                accounts={activeMercadoPagoAccounts}
                selectedAccountId={mercadoPagoAccountId}
                selectedAccount={selectedMercadoPagoAccount}
                attempt={mercadoPagoAttempt}
                message={mercadoPagoMessage}
                technicalDetail={mercadoPagoTechnicalDetail}
                movements={mercadoPagoMovements}
                disabled={paymentsDisabled || isPending}
                remaining={remaining}
                matchCount={mercadoPagoMatchCandidates.length}
                recentRefreshSeconds={Number(mercadoPagoRecentRefreshSeconds)}
                modalOpen={mercadoPagoMovementsModalOpen}
                lastMovementQueryAt={mercadoPagoLastMovementQueryAt}
                onAccountChange={(accountId) => {
                  setMercadoPagoAccountId(accountId);
                  window.localStorage.setItem(
                    MERCADO_PAGO_SELECTED_ACCOUNT_STORAGE_KEY,
                    accountId
                  );
                  setMercadoPagoAttempt(null);
                  setMercadoPagoMovements([]);
                  setMercadoPagoMessage(null);
                  setMercadoPagoTechnicalDetail(null);
                  setMercadoPagoQrModalOpen(false);
                  setMercadoPagoMovementsModalOpen(false);
                  setMercadoPagoApplyDialog(null);
                  setMercadoPagoMatchPollingEnabled(false);

                  setMercadoPagoMatchStartedAt(null);
                  setMercadoPagoMatchTimedOut(false);
                  setMercadoPagoLastMovementQueryAt(null);
                }}
                onGenerate={generateMercadoPagoQr}
                onOpenQr={() => setMercadoPagoQrModalOpen(true)}
                onRefresh={() => refreshMercadoPagoAttempt(true)}
                onCancel={cancelMercadoPagoQrAttempt}
                onSearchRecent={searchMercadoPagoMovements}
                onFindMatches={highlightMercadoPagoMatches}
              />
            ) : (
              <div className="space-y-3">
                {isTransferPaymentMethod ? (
                  <TransferVerificationPanel
                    accounts={activeMercadoPagoAccounts}
                    selectedAccountId={transferVerificationAccountId}
                    selectedAccount={selectedTransferVerificationAccount}
                    enabled={transferVerificationEnabled}
                    showRecentMovements={transferShowRecentMovements}
                    disabled={paymentsDisabled || isPending}
                    remaining={remaining}
                    recentRefreshSeconds={Number(transferRecentRefreshSeconds)}
                    modalOpen={
                      mercadoPagoMovementsModalOpen &&
                      movementModalContext === "TRANSFER"
                    }
                    lastMovementQueryAt={transferLastMovementQueryAt}
                    onEnabledChange={setTransferVerificationEnabled}
                    onAccountChange={(accountId) => {
                      setTransferVerificationAccountId(accountId);
                      window.localStorage.setItem(
                        TRANSFER_SELECTED_VERIFICATION_ACCOUNT_STORAGE_KEY,
                        accountId
                      );
                      setMercadoPagoMovements([]);
                      setMercadoPagoMessage(null);
                      setMercadoPagoTechnicalDetail(null);
                      setTransferLastMovementQueryAt(null);
                    }}
                    onSearchRecent={() =>
                      searchTransferMovements({
                        openModal: true,
                        message: "Buscando transferencias recientes..."
                      })
                    }
                    onRefresh={() =>
                      searchTransferMovements({
                        openModal: false,
                        message: "Actualizando transferencias recientes..."
                      })
                    }
                  />
                ) : null}
                {!["DEBIT", "CREDIT"].includes(paymentMethod) ? (
                  <PaymentMethodInfo
                    method={paymentMethod}
                    setting={selectedPaymentSetting}
                    disabled={paymentsDisabled}
                    copyFeedback={copyFeedback}
                    onCopy={copyPaymentData}
                  />
                ) : null}
              </div>
            )}

            {paymentMethod === "CREDIT" ? (
              <div className="cash-credit-panel app-panel-elevated space-y-2 rounded-lg p-2.5 shadow-sm dark:shadow-none">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-2 py-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Recargo
                    </span>
                    <span className="font-black text-[var(--text-primary)]">
                      {formatARS(surchargeAmount)}
                    </span>
                  </div>
                  <div className="rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-2 py-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Por cuota
                    </span>
                    <span className="font-black text-[var(--text-primary)]">
                      {formatARS(
                        effectiveInstallments > 0
                          ? roundMoney(total / effectiveInstallments)
                          : total
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {showPaymentReference ? (
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
              <div className="badge-warning space-y-2.5 rounded-lg p-3">
                <p className="text-sm font-medium">
                  Esta venta se cargara a cuenta corriente.
                </p>
                <label className="space-y-1.5">
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
                  <div className="space-y-1.5">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="app-panel-elevated w-full rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-[var(--primary-soft)]"
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
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
                    className="h-10 text-base font-semibold"
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
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
                    className="h-10 text-base font-semibold"
                  />
                </label>
                {!paymentsDisabled ? (
                  <>
                    <div className="cash-quick-cash flex flex-wrap gap-1.5">
                      {quickCashAmounts.map((amount, index) => (
                        <Button
                          key={`${amount}-${index}`}
                          type="button"
                          size="sm"
                          className="btn-secondary"
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
                ) : null}
              </>
            ) : (
              <div className="cash-amount-panel space-y-2">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
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
                    className="cash-amount-input h-10 text-base font-semibold"
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
          ) : null}

          {!saleSuccess && payments.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {paymentsMatch ? (
                <AppliedPaymentSummary
                  payments={payments}
                  paymentLabels={paymentLabels}
                  totalPaid={totalPaid}
                  onRemove={removePayment}
                />
              ) : (
                <>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">
                    Pagos cargados
                  </h2>
                  <div className="cash-loaded-payments space-y-1.5">
                    {payments.map((payment) => (
                      <PaymentEntryRow
                        key={payment.id}
                        payment={payment}
                        label={paymentLabels[payment.method]}
                        onRemove={() => removePayment(payment.id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {saleSuccess ? (
            <SaleConfirmedPanel
              saleSuccess={saleSuccess}
              printSetting={printSetting}
              canAccessFiscalAdmin={canAccessFiscalAdmin}
              onNewSale={cancelSale}
            />
          ) : null}

          {message &&
          !(
            message.tone === "ok" &&
            (saleSuccess || (paymentsMatch && payments.length > 0))
          ) ? (
            <p
              className={
                message.tone === "ok"
                  ? "badge-success mt-3 rounded-md px-3 py-2 text-sm"
                  : "badge-danger mt-3 rounded-md px-3 py-2 text-sm"
              }
            >
              {message.text}
            </p>
          ) : null}
          </div>

          {!saleSuccess ? (
          <div className="cash-actions mt-4 grid gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={!canFinish}
              className="h-12 w-full text-base font-bold tracking-wide shadow-[0_14px_30px_rgba(46,91,122,0.18)] transition-all duration-200 hover:shadow-[0_18px_36px_rgba(46,91,122,0.28)] active:scale-[0.99] disabled:shadow-none"
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
          ) : null}
        </Card>
      </aside>
      <AppModal
        open={Boolean(offlineReceipt)}
        onClose={() => setOfflineReceipt(null)}
        title="Venta offline guardada"
        description="Quedo registrada en este equipo y se sincronizara automaticamente al recuperar la conexion."
        panelClassName="max-w-md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOfflineReceipt(null)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (!offlineReceipt) return;
                try {
                  printOfflineTicket(offlineReceipt);
                } catch (error) {
                  showMessage(
                    error instanceof Error ? error.message : "No se pudo abrir el comprobante provisional.",
                    "error"
                  );
                }
              }}
            >
              Imprimir comprobante provisional
            </Button>
          </div>
        }
      >
        {offlineReceipt ? (
          <div className="space-y-3 text-sm">
            <div className="app-panel-elevated rounded-lg p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Operacion local
              </p>
              <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {offlineReceipt.offlineNumber}
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                Total {formatARS(offlineReceipt.total)} - Efectivo {formatARS(offlineReceipt.cashReceived)}
              </p>
            </div>
            <div className="badge-warning rounded-lg px-3 py-2 text-xs font-semibold">
              COMPROBANTE INTERNO. VENTA PENDIENTE DE SINCRONIZACION. NO VALIDO COMO COMPROBANTE FISCAL.
            </div>
          </div>
        ) : null}
      </AppModal>
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
      <AppModal
        open={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setManualItemError(null);
        }}
        title="Agregar artículo manual"
        description="Usalo para vender un artículo que no está cargado en Productos."
        panelClassName="max-w-md"
      >
        <form onSubmit={handleAddManualItem} className="space-y-4">
          {manualItemError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              {manualItemError}
            </div>
          ) : null}

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Nombre del artículo
              </span>
              <Input
                required
                value={manualItemName}
                onChange={(e) => setManualItemName(e.target.value)}
                placeholder="Ej: Pan suelto, Bolsa de hielo, etc."
                className="h-10 text-sm font-semibold"
                maxLength={80}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Precio unitario
                </span>
                <Input
                  required
                  inputMode="decimal"
                  value={manualItemPrice}
                  onChange={(e) => setManualItemPrice(sanitizeMoneyInput(e.target.value))}
                  placeholder="0.00"
                  className="h-10 text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  Cantidad
                </span>
                <Input
                  required
                  inputMode="decimal"
                  value={manualItemQuantity}
                  onChange={(e) => setManualItemQuantity(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
                  placeholder="1"
                  className="h-10 text-sm font-semibold"
                />
              </label>
            </div>

            <div className="app-panel-secondary rounded-lg p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold">
                Subtotal estimado: {formatARS(safeNumber(manualItemPrice.replace(",", ".")) * safeNumber(manualItemQuantity.replace(",", ".")))}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Este artículo se agregará sólo a esta venta. No se guardará en Productos ni modificará stock.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--panel-border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsManualModalOpen(false);
                setManualItemError(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Agregar a venta
            </Button>
          </div>
        </form>
      </AppModal>
      <MercadoPagoMovementsDrawer
        open={mercadoPagoMovementsModalOpen}
        context={movementModalContext}
        account={movementModalAccount}
        movements={mercadoPagoMovements}
        targetAmount={remaining}
        amountTolerance={movementModalAmountTolerance}
        matchCount={movementModalMatchCount}
        message={mercadoPagoMessage}
        technicalDetail={mercadoPagoTechnicalDetail}
        pending={isPending}
        qrPending={
          movementModalContext === "MERCADOPAGO" &&
          mercadoPagoAttemptStatus === "PENDING"
        }
        rangeValue={movementModalRange}
        limitValue={movementModalLimit}
        refreshSecondsValue={movementModalRefreshSeconds}
        lastQueryAt={movementModalLastQueryAt}
        onClose={() => setMercadoPagoMovementsModalOpen(false)}
        onRefresh={
          movementModalContext === "TRANSFER"
            ? searchTransferMovements
            : searchMercadoPagoMovements
        }
        onFindMatches={
          movementModalContext === "TRANSFER"
            ? highlightTransferMatches
            : highlightMercadoPagoMatches
        }
        onRangeChange={
          movementModalContext === "TRANSFER"
            ? setTransferRecentRange
            : setMercadoPagoRecentRange
        }
        onLimitChange={
          movementModalContext === "TRANSFER"
            ? setTransferRecentLimit
            : setMercadoPagoRecentLimit
        }
        onRefreshSecondsChange={
          movementModalContext === "TRANSFER"
            ? setTransferRecentRefreshSeconds
            : setMercadoPagoRecentRefreshSeconds
        }
        onAssociate={associateMercadoPagoMovement}
      />
      <MercadoPagoApplyPaymentDialog
        state={mercadoPagoApplyDialog}
        pending={isPending}
        onClose={() => setMercadoPagoApplyDialog(null)}
        onConfirm={confirmMercadoPagoMovementAssociation}
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

function TransferVerificationPanel({
  accounts,
  selectedAccountId,
  selectedAccount,
  enabled,
  showRecentMovements,
  disabled,
  remaining,
  recentRefreshSeconds,
  modalOpen,
  lastMovementQueryAt,
  onEnabledChange,
  onAccountChange,
  onSearchRecent,
  onRefresh
}: {
  accounts: MercadoPagoAccountView[];
  selectedAccountId: string;
  selectedAccount: MercadoPagoAccountView | null;
  enabled: boolean;
  showRecentMovements: boolean;
  disabled: boolean;
  remaining: number;
  recentRefreshSeconds: number;
  modalOpen: boolean;
  lastMovementQueryAt: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onAccountChange: (accountId: string) => void;
  onSearchRecent: () => void;
  onRefresh: () => void;
}) {
  const hasAccounts = accounts.length > 0;
  const controlsDisabled =
    disabled || !enabled || !showRecentMovements || !selectedAccount || remaining <= 0;

  return (
    <div className="cash-payment-method-panel app-panel-elevated space-y-2 rounded-lg p-2.5 text-sm shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Transferencia
          </p>
          <p className="mt-0.5 truncate text-xs leading-4 text-[var(--text-secondary)]">
            {selectedAccount ? selectedAccount.name : "Verificacion opcional"}
          </p>
        </div>
        <MercadoPagoMovementBadge tone={enabled && hasAccounts ? "ok" : "muted"}>
          {enabled && hasAccounts ? "Activa" : "Manual"}
        </MercadoPagoMovementBadge>
      </div>

      {hasAccounts ? (
        <div className="grid gap-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Cuenta destino
            </span>
            <Select
              value={selectedAccountId}
              disabled={disabled || !enabled}
              onChange={(event) => onAccountChange(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {mercadoPagoEnvironmentLabel(account.environment)}
                </option>
              ))}
            </Select>
          </label>

          <div className="cash-payment-brief rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">
              {formatARS(remaining)}
            </span>{" "}
            pendiente - {showRecentMovements ? "cobros visibles" : "cobros ocultos"}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={controlsDisabled}
              onClick={onSearchRecent}
            >
              Cobros recientes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="btn-secondary"
              disabled={controlsDisabled}
              onClick={onRefresh}
            >
              Actualizar ahora
            </Button>
          </div>

          <AppAccordion
            title="Detalles de verificacion"
            className="cash-payment-details px-2.5 py-1.5"
          >
            <div className="grid gap-2 text-[var(--text-secondary)]">
              <div className="grid grid-cols-2 gap-2">
                <PaymentDataLine label="Proveedor" value="Mercado Pago" />
                <PaymentDataLine label="Modo" value="Verificacion" />
              </div>
              <p>
                Auto:{" "}
                {showRecentMovements && recentRefreshSeconds > 0 && modalOpen
                  ? `cada ${recentRefreshSeconds}s`
                  : showRecentMovements && recentRefreshSeconds > 0
                    ? `listo cada ${recentRefreshSeconds}s al abrir`
                    : "desactivado"}
              </p>
              <p>Ultima consulta: {formatMercadoPagoClock(lastMovementQueryAt)}</p>
              {!enabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="btn-secondary w-full"
                  onClick={() => onEnabledChange(true)}
                >
                  Activar verificacion
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  disabled={disabled}
                  onClick={() => onEnabledChange(false)}
                >
                  Usar transferencia manual sin verificacion
                </Button>
              )}
            </div>
          </AppAccordion>
        </div>
      ) : (
        <p className="badge-warning rounded-md px-3 py-2 text-xs">
          No hay cuentas Mercado Pago conectadas. Podes seguir cargando la transferencia
          manualmente o vincular una cuenta en Configuracion &gt; Pagos.
        </p>
      )}
    </div>
  );
}

function MercadoPagoApiPanel({
  accounts,
  selectedAccountId,
  selectedAccount,
  attempt,
  message,
  technicalDetail,
  movements,
  disabled,
  remaining,
  matchCount,
  recentRefreshSeconds,
  modalOpen,
  lastMovementQueryAt,
  onAccountChange,
  onGenerate,
  onOpenQr,
  onRefresh,
  onCancel,
  onSearchRecent,
  onFindMatches
}: {
  accounts: MercadoPagoAccountView[];
  selectedAccountId: string;
  selectedAccount: MercadoPagoAccountView | null;
  attempt: MercadoPagoAttemptView | null;
  message: string | null;
  technicalDetail: string | null;
  movements: MercadoPagoMovementView[];
  disabled: boolean;
  remaining: number;
  matchCount: number;
  recentRefreshSeconds: number;
  modalOpen: boolean;
  lastMovementQueryAt: string | null;
  onAccountChange: (accountId: string) => void;
  onGenerate: () => void;
  onOpenQr: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onSearchRecent: () => void;
  onFindMatches: () => void;
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
      <div className="cash-payment-method-panel badge-success space-y-2 rounded-lg p-2.5 text-sm shadow-sm dark:shadow-none">
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
    <div className="cash-payment-method-panel app-panel-elevated space-y-2 rounded-lg p-2.5 text-sm shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Mercado Pago
          </p>
          {attempt ? (
            <p className="mt-0.5 text-base font-extrabold text-[var(--text-primary)]">
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
        <div className="cash-payment-brief rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
          <p className="truncate" title={attempt.accountName}>
            Cuenta: {attempt.accountName}
          </p>
          <p className="mt-0.5 truncate" title={attempt.externalReference}>
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
            <div className="cash-payment-brief flex items-center justify-between gap-2 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-2.5 py-1.5 text-xs">
              <span className="truncate font-semibold text-[var(--text-primary)]">
                {mercadoPagoEnvironmentLabel(selectedAccount.environment)}
              </span>
              <span className="shrink-0 text-[var(--text-secondary)]">
                {modalOpen && recentRefreshSeconds > 0
                  ? `auto ${recentRefreshSeconds}s`
                  : "busqueda manual"}
              </span>
            </div>
          ) : null}
        </>
      )}

      {!attempt ? (
        <div className="grid grid-cols-2 gap-1.5">
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="btn-secondary w-full"
            disabled={disabled || !selectedAccount || !selectedAccount.showRecentMovements}
            onClick={onSearchRecent}
          >
            Cobros recientes
          </Button>
        </div>
      ) : null}

      {pendingAttempt || failedAttempt ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Button type="button" size="sm" variant="secondary" onClick={onOpenQr}>
            Ver QR
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onRefresh}>
            Refrescar
          </Button>
          {pendingAttempt ? (
            <Button type="button" size="sm" variant="danger" className="col-span-2" onClick={onCancel}>
              Cancelar intento
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="col-span-2"
              disabled={disabled || !selectedAccount || remaining <= 0}
              onClick={onGenerate}
            >
              Nuevo QR
            </Button>
          )}
        </div>
      ) : null}

      {!attempt ? (
        <AppAccordion
          title="Detalles y coincidencias"
          className="cash-payment-details px-2.5 py-1.5"
        >
          <div className="grid gap-2 text-[var(--text-secondary)]">
            <p>Ultima consulta: {formatMercadoPagoClock(lastMovementQueryAt)}</p>
            <p>
              Match por monto:{" "}
              {selectedAccount?.enableAmountMatching ? "activo" : "deshabilitado"}
            </p>
            {matchCount > 0 ? (
              <p className="font-semibold text-[var(--warning)]">
                {matchCount} cobro{matchCount === 1 ? "" : "s"} coincide{matchCount === 1 ? "" : "n"} con el pendiente.
              </p>
            ) : null}
            {selectedAccount?.enableAmountMatching ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="btn-secondary"
                disabled={disabled || remaining <= 0}
                onClick={onFindMatches}
              >
                Resaltar coincidencias
              </Button>
            ) : null}
          </div>
        </AppAccordion>
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
            <AppAccordion title="Ver detalle tecnico" className="mt-2">
              <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
                {technicalDetail}
              </pre>
            </AppAccordion>
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
    <AppAccordion title="Ver detalle" className="app-panel-secondary rounded-md">
      <dl className="grid gap-2 text-[var(--text-secondary)]">
        <CompactDetailLine label="Cuenta" value={account?.name ?? attempt.accountName} />
        <CompactDetailLine
          label="Origen"
          value={attempt.origin === "QR_ORDER" ? "QR por venta" : "Coincidencia por monto"}
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
    </AppAccordion>
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

function MercadoPagoMovementsDrawer({
  open,
  context,
  account,
  movements,
  targetAmount,
  amountTolerance,
  matchCount,
  message,
  technicalDetail,
  pending,
  qrPending,
  rangeValue,
  limitValue,
  refreshSecondsValue,
  lastQueryAt,
  onClose,
  onRefresh,
  onFindMatches,
  onRangeChange,
  onLimitChange,
  onRefreshSecondsChange,
  onAssociate
}: {
  open: boolean;
  context: "MERCADOPAGO" | "TRANSFER";
  account: MercadoPagoAccountView | null;
  movements: MercadoPagoMovementView[];
  targetAmount: number;
  amountTolerance: string | number;
  matchCount: number;
  message: string | null;
  technicalDetail: string | null;
  pending: boolean;
  qrPending: boolean;
  rangeValue: string;
  limitValue: string;
  refreshSecondsValue: string;
  lastQueryAt: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onFindMatches: () => void;
  onRangeChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onRefreshSecondsChange: (value: string) => void;
  onAssociate: (movement: MercadoPagoMovementView) => void;
}) {
  if (!open) {
    return null;
  }

  const isTransferContext = context === "TRANSFER";

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={isTransferContext ? "Transferencias recientes" : "Cobros recientes Mercado Pago"}
      description={
        account
          ? `${account.name} - pendiente ${formatARS(targetAmount)}`
          : "Cuenta Mercado Pago"
      }
      panelClassName="max-w-[min(100vw-1.5rem,820px)]"
    >
      <div className="space-y-3">
        <div className="app-panel-secondary rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)]">
          <p>
            {isTransferContext
              ? "Metodo visible: Transferencia. Verificacion por Mercado Pago, sin QR."
              : "Mercado Pago puede devolver pagos/cobros recientes de la cuenta."}
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="app-panel-elevated rounded-lg px-3 py-2">
            <p className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Cuenta
            </p>
            <p className="mt-0.5 truncate font-semibold text-[var(--text-primary)]">
              {account?.name ?? "Sin cuenta seleccionada"}
            </p>
          </div>
          <div className="app-panel-elevated rounded-lg px-3 py-2">
            <p className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Pendiente
            </p>
            <p className="mt-0.5 text-base font-black text-[var(--text-primary)]">
              {formatARS(targetAmount)}
            </p>
          </div>
        </div>

        {qrPending ? (
          <p className="badge-warning rounded-lg px-3 py-2 text-xs">
            Hay un QR pendiente. Asociar otro cobro puede duplicar el pago.
          </p>
        ) : null}

        <div className="app-panel-elevated grid gap-2 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-[1fr_1fr_1fr_auto]">
            <Select
              value={rangeValue}
              className="h-9 text-xs"
              onChange={(event) => onRangeChange(event.target.value)}
            >
              <option value="10">10 min</option>
              <option value="30">30 min</option>
              <option value="120">2 hs</option>
              <option value="today">Hoy</option>
            </Select>
            <Select
              value={limitValue}
              className="h-9 text-xs"
              onChange={(event) => onLimitChange(event.target.value)}
            >
              <option value="5">Ultimas 5</option>
              <option value="10">Ultimas 10</option>
              <option value="20">Ultimas 20</option>
            </Select>
            <Select
              value={refreshSecondsValue}
              className="h-9 text-xs"
              onChange={(event) => onRefreshSecondsChange(event.target.value)}
            >
              <option value="0">Auto off</option>
              <option value="5">Auto 5s</option>
              <option value="10">Auto 10s</option>
              <option value="15">Auto 15s</option>
            </Select>
            <Button type="button" size="sm" variant="secondary" onClick={onRefresh}>
              Refrescar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {account?.enableAmountMatching ? (
              <Button type="button" size="sm" variant="primary" onClick={onFindMatches}>
                Resaltar coincidencias
              </Button>
            ) : null}
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {matchCount > 0
                ? `${matchCount} coincidencia${matchCount === 1 ? "" : "s"}`
                : "Sin coincidencias destacadas"}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Ultima consulta: {formatMercadoPagoClock(lastQueryAt)}
            </span>
          </div>
        </div>

        {message ? (
          <p className="app-panel-elevated rounded-md px-3 py-2 text-xs text-[var(--text-secondary)]">
            {message}
          </p>
        ) : null}

        {technicalDetail ? (
          <AppAccordion title="Ver detalle tecnico" className="badge-danger">
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--panel-border)] bg-[var(--app-bg)] p-2 text-[11px] leading-4 text-[var(--danger)]">
              {technicalDetail}
            </pre>
          </AppAccordion>
        ) : null}

        <div className="space-y-2">
          {movements.length === 0 ? (
            <div className="app-panel-secondary rounded-lg px-3 py-8 text-center text-sm text-[var(--text-muted)]">
              Sin cobros recientes detectados.
            </div>
          ) : (
            movements.map((movement) => (
              <MercadoPagoMovementRow
                key={movement.id}
                context={context}
                movement={movement}
                account={account}
                targetAmount={targetAmount}
                amountTolerance={amountTolerance}
                disabled={pending}
                onAssociate={() => onAssociate(movement)}
              />
            ))
          )}
        </div>
      </div>
    </AppModal>
  );
}

function MercadoPagoMovementRow({
  context,
  movement,
  account,
  targetAmount,
  amountTolerance,
  disabled,
  onAssociate
}: {
  context: "MERCADOPAGO" | "TRANSFER";
  movement: MercadoPagoMovementView;
  account: MercadoPagoAccountView | null;
  targetAmount: number;
  amountTolerance: string | number;
  disabled: boolean;
  onAssociate: () => void;
}) {
  const isTransferContext = context === "TRANSFER";
  const matchesAmount = isMercadoPagoExactAmountMatch(movement.amount, targetAmount);
  const approved = isMercadoPagoMovementApproved(movement);
  const movementAmount = roundMoney(safeNumber(movement.amount));
  const diff = movementAmount - targetAmount;

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
              <MercadoPagoMovementBadge tone="ok">Coincide</MercadoPagoMovementBadge>
            ) : approved && !movement.alreadyUsed ? (
              <>
                <MercadoPagoMovementBadge tone="warn">No coincide</MercadoPagoMovementBadge>
                {diff > 0.01 ? (
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Sobran {formatARS(diff)}
                  </span>
                ) : diff < -0.01 ? (
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Faltan {formatARS(Math.abs(diff))}
                  </span>
                ) : null}
              </>
            ) : null}
            {movement.alreadyUsed ? (
              <MercadoPagoMovementBadge tone="muted">
                {movement.usedSaleNumber
                  ? `Usado en #${movement.usedSaleNumber}`
                  : "Usado"}
              </MercadoPagoMovementBadge>
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
          {movement.payerLabelSafe || movement.externalReference ? (
            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
              {[movement.payerLabelSafe, movement.externalReference]
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
          {movement.alreadyUsed
            ? movement.usedSaleNumber
              ? `Usado en #${movement.usedSaleNumber}`
              : "Usado"
            : !approved
              ? "No aprobado"
              : matchesAmount
                ? isTransferContext
                  ? "Aplicar transferencia"
                  : "Aplicar a esta venta"
                : "Usar igual"}
        </Button>
      </div>
      <AppAccordion title="Ver detalle tecnico" className="mt-2">
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--panel-border)] bg-[var(--app-bg)] p-2 text-[11px] text-[var(--text-secondary)]">
          {JSON.stringify(movement.rawSummary, null, 2)}
        </pre>
      </AppAccordion>
    </div>
  );
}

function MercadoPagoApplyPaymentDialog({
  state,
  pending,
  onClose,
  onConfirm
}: {
  state: MercadoPagoApplyDialogState | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!state) {
    return null;
  }

  const movement = state.movement;
  const amount = roundMoney(safeNumber(movement.amount));
  const targetAmount = roundMoney(state.targetAmount);
  const exactMatch = isMercadoPagoExactAmountMatch(movement.amount, targetAmount);
  const exceedsPending = amount > targetAmount + 0.01;
  const partialPayment = amount < targetAmount - 0.01;
  const partialBlocked = partialPayment && !state.allowPartial;
  const statusTone = exactMatch ? "ok" : "warn";
  const statusLabel = exactMatch
    ? "Coincide"
    : "No coincide";
  const isTransferPayment = state.paymentMethod === "TRANSFER";
  const shouldBlockApply = partialBlocked;
  const diff = amount - targetAmount;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mercado-pago-apply-dialog-title"
    >
      <div className="app-panel w-full max-w-lg overflow-hidden rounded-xl border border-[color:var(--panel-border)] shadow-2xl dark:shadow-black/40">
        <div className="border-b border-[color:var(--panel-border)] bg-[var(--panel-bg-elevated)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="mercado-pago-apply-dialog-title"
                className="text-lg font-extrabold text-[var(--text-primary)]"
              >
                {isTransferPayment
                  ? "Aplicar transferencia a la venta"
                  : "Aplicar cobro a la venta"}
              </h2>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {isTransferPayment
                  ? "Revisa la transferencia detectada antes de cargarla como pago por transferencia."
                  : "Revisa el movimiento detectado antes de cargarlo como pago Mercado Pago."}
              </p>
            </div>
            <MercadoPagoMovementBadge tone="ok">Aprobado</MercadoPagoMovementBadge>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-lg border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {isTransferPayment ? "Monto de la transferencia" : "Monto del cobro"}
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
                {formatARS(amount)}
              </p>
              <MercadoPagoMovementBadge tone={statusTone}>
                {statusLabel}
              </MercadoPagoMovementBadge>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Saldo pendiente de la venta:{" "}
              <span className="font-bold text-[var(--text-primary)]">
                {formatARS(targetAmount)}
              </span>
            </p>
          </div>

          {!exactMatch ? (
            <p className="badge-danger rounded-lg px-3 py-2 text-sm font-bold text-center">
              El monto de la transferencia no coincide con el monto pendiente de la venta.
            </p>
          ) : (
            <p className="badge-success rounded-lg px-3 py-2 text-sm">
              El importe coincide exactamente con el saldo pendiente.
            </p>
          )}

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <MercadoPagoApplyDetail label="Cuenta" value={state.accountName} />
            <MercadoPagoApplyDetail
              label="Hora"
              value={formatMercadoPagoDate(movement.dateApproved ?? movement.dateCreated)}
            />
            {!exactMatch ? (
              <MercadoPagoApplyDetail
                label="Diferencia"
                value={
                  diff > 0.01
                    ? `Sobran ${formatARS(diff)}`
                    : diff < -0.01
                      ? `Faltan ${formatARS(Math.abs(diff))}`
                      : "-"
                }
              />
            ) : null}
            <MercadoPagoApplyDetail
              label="Referencia"
              value={movement.externalReference ?? "-"}
            />
            <MercadoPagoApplyDetail label="ID de pago (providerPaymentId)" value={movement.id} />
            <MercadoPagoApplyDetail
              label="Estado"
              value={mercadoPagoMovementStatusLabel(movement.status)}
            />
            <MercadoPagoApplyDetail
              label="Operacion"
              value={
                [movement.paymentMethod, movement.paymentType, movement.operationType]
                  .filter(Boolean)
                  .join(" / ") || "-"
              }
            />
          </dl>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[color:var(--panel-border)] bg-[var(--panel-bg-elevated)] px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {shouldBlockApply ? "Cerrar" : "Cancelar"}
          </Button>
          {!shouldBlockApply ? (
            <Button type="button" variant="primary" disabled={pending} onClick={onConfirm}>
              {pending
                ? "Aplicando..."
                : !exactMatch
                  ? "Aplicar igualmente"
                  : isTransferPayment
                    ? "Aplicar transferencia"
                    : "Aplicar cobro"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MercadoPagoApplyDetail({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg-secondary)] px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </dd>
    </div>
  );
}

function MercadoPagoMovementBadge({
  children,
  tone
}: {
  children: ReactNode;
  tone: "ok" | "warn" | "muted" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone === "ok" && "badge-success",
        tone === "warn" && "badge-warning",
        tone === "danger" && "badge-danger",
        tone === "muted" && "badge-neutral"
      )}
    >
      {children}
    </span>
  );
}

function AppliedPaymentSummary({
  payments,
  paymentLabels,
  totalPaid,
  onRemove
}: {
  payments: PaymentEntry[];
  paymentLabels: Record<PaymentMethodValue, string>;
  totalPaid: number;
  onRemove: (paymentId: string) => void;
}) {
  const primaryPayment = payments[0];
  if (!primaryPayment) {
    return null;
  }

  const singlePayment = payments.length === 1;
  const detail = paymentEntryDescription(primaryPayment);

  return (
    <div className="badge-success rounded-lg px-3 py-2.5 text-sm shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Pago aplicado
          </p>
          <p className="mt-1 text-2xl font-black leading-none text-[var(--success)]">
            {formatARS(totalPaid)}
          </p>
          <p className="mt-1 truncate font-semibold text-[var(--text-primary)]">
            {singlePayment
              ? paymentLabels[primaryPayment.method]
              : `${payments.length} pagos cargados`}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]" title={detail}>
            {detail}
          </p>
        </div>
        {singlePayment ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(primaryPayment.id)}
          >
            Quitar
          </Button>
        ) : null}
      </div>

      <p className="mt-2 rounded-md border border-[color:var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]">
        Pago completo. Finalizá la venta para registrarla.
      </p>

      {singlePayment ? (
        <AppAccordion title="Ver detalle" className="mt-2 bg-[var(--panel-bg)]">
          <PaymentEntryRow
            payment={primaryPayment}
            label={paymentLabels[primaryPayment.method]}
            onRemove={() => onRemove(primaryPayment.id)}
          />
        </AppAccordion>
      ) : (
        <AppAccordion title="Ver pagos cargados" className="mt-2 bg-[var(--panel-bg)]">
          <div className="space-y-1.5">
            {payments.map((payment) => (
              <PaymentEntryRow
                key={payment.id}
                payment={payment}
                label={paymentLabels[payment.method]}
                onRemove={() => onRemove(payment.id)}
              />
            ))}
          </div>
        </AppAccordion>
      )}
    </div>
  );
}

function SaleConfirmedPanel({
  saleSuccess,
  printSetting,
  canAccessFiscalAdmin,
  onNewSale
}: {
  saleSuccess: SaleSuccess;
  printSetting: PrintSettingView;
  canAccessFiscalAdmin: boolean;
  onNewSale: () => void;
}) {
  const fiscalLabel =
    saleSuccess.fiscalStatus
      ? fiscalStatusLabels[saleSuccess.fiscalStatus] ?? saleSuccess.fiscalStatus
      : "Ticket interno";

  return (
    <div className="badge-success mt-3 rounded-lg px-3 py-3 text-sm shadow-sm dark:shadow-none">
      <p className="text-lg font-black leading-tight text-[var(--text-primary)]">
        Venta #{saleSuccess.internalSaleNumber} confirmada
      </p>

      <div className="mt-3 grid gap-2">
        <PaymentDataLine label="Total" value={formatARS(saleSuccess.totalAmount)} />
        <PaymentDataLine label="Pago" value={saleSuccess.paymentLabel} />
        <PaymentDataLine label="Comprobante fiscal" value={fiscalLabel} />
      </div>

      <div className="mt-3 grid gap-2">
        <Button type="button" variant="primary" className="h-11 w-full" onClick={onNewSale}>
          Nueva venta
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <PrintButton
            saleId={saleSuccess.saleId}
            setting={printSetting}
            printHref={buildTicketHref(saleSuccess.saleId, "/caja", {
              print: true
            })}
          />
          <LinkButton href={`/ventas/${saleSuccess.saleId}`}>
            Ver venta
          </LinkButton>
        </div>
        <AppAccordion title="Más acciones" className="bg-[var(--panel-bg)]">
          <div className="grid gap-2">
            <LinkButton href={buildTicketHref(saleSuccess.saleId, "/caja")}>
              Ver ticket
            </LinkButton>
            {canAccessFiscalAdmin && isFiscalQueueStatus(saleSuccess.fiscalStatus) ? (
              <LinkButton href="/facturacion">
                Ver facturacion
              </LinkButton>
            ) : null}
          </div>
        </AppAccordion>
      </div>
    </div>
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
  if (
    payment.method === "MERCADOPAGO" ||
    (payment.method === "TRANSFER" && payment.paymentAttemptId)
  ) {
    const status =
      payment.method === "MERCADOPAGO"
        ? mercadoPagoAttemptStatusLabel(payment.providerStatus ?? "")
        : providerStatusLabel(payment.providerStatus);
    const detail = [
      payment.mercadoPagoOrigin ??
        (payment.method === "TRANSFER" ? "Verificada por Mercado Pago" : "QR por venta"),
      payment.mercadoPagoAccountName,
      payment.externalReference ? `Ref: ${shortReference(payment.externalReference)}` : null
    ]
      .filter(Boolean)
      .join(" - ");

    return (
      <div className="badge-success flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm shadow-sm dark:shadow-none">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">
            {label}
          </p>
          <p className="text-base font-black leading-tight text-[var(--success)]">
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
    <div className="app-panel-elevated flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm shadow-sm dark:shadow-none">
      <div className="min-w-0">
        <p className="font-bold text-[var(--text-primary)]">
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
    <div className="app-panel-elevated space-y-2.5 rounded-lg p-2.5 text-sm shadow-sm dark:shadow-none">
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

      <div className="grid gap-1.5">
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
        <p className="app-panel-secondary rounded-md px-3 py-1.5 text-xs text-[var(--text-secondary)]">
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
    <div className="app-panel-secondary flex items-center justify-between gap-3 rounded-md px-3 py-1.5">
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
    <div className="app-panel-secondary flex items-center justify-between gap-2 rounded-md px-3 py-1.5">
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
  offlineStock = false,
  selectedIndex,
  onAddProduct
}: {
  title: string;
  products: CashProductResult[];
  compact: boolean;
  offlineStock?: boolean;
  selectedIndex?: number;
  onAddProduct: (product: CashProductResult) => void;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className={cn("cash-product-section", compact ? "mt-2" : "mt-4")}>
      <h2
        className={cn(
          "font-black uppercase tracking-[0.12em] text-[var(--text-primary)]",
          compact ? "text-[11px]" : "text-sm"
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          compact ? "mt-2 grid gap-2" : "mt-3 grid gap-2",
          compact
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
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
              compact ? "cash-product-card min-h-[78px] p-2" : "min-h-[108px] p-3",
              selectedIndex === index &&
                "border-[color:var(--primary)] bg-[var(--primary-soft)] border-l-[color:var(--primary)] ring-2 ring-[color:var(--panel-border-strong)]"
            )}
          >
            <span
              className={cn(
                "line-clamp-2 font-bold text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-primary)]",
                compact ? "min-h-7 text-[12px] leading-4" : "min-h-10 text-sm"
              )}
            >
              {product.name}
            </span>
            <span className={cn("mt-auto block truncate font-black text-[var(--primary)]", compact ? "pt-1.5 text-sm" : "pt-3 text-base")}>
              {formatARS(product.salePrice)}
            </span>
            <span className={cn("mt-0.5 block truncate text-[var(--text-secondary)]", compact ? "text-[10px]" : "text-xs")}>
              {product.categoryName} - {formatStock(product.stock, product.unitType)}
              {offlineStock ? " (estimado)" : ""}
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
        "cash-summary-value rounded-lg border p-2.5 shadow-sm transition-colors duration-200",
        tone === "default" && "badge-warning",
        tone === "ok" && "badge-success",
        tone === "error" && "badge-danger"
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-black leading-tight 2xl:text-xl",
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
    <div className="cash-payment-preview app-panel-elevated rounded-lg p-3 shadow-sm dark:shadow-none">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 text-2xl font-black text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}

type QuantityConfig = Pick<CashProductResult, "allowsDecimalQuantity" | "unitType">;

function allowsDecimal(item: QuantityConfig) {
  return item.allowsDecimalQuantity || decimalUnits.has(item.unitType);
}

function createManualCartItem(name: string, price: string, quantity: string): CartItem {
  return {
    id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    barcode: null,
    sku: null,
    salePrice: price,
    stock: "0",
    unitType: "UNIT",
    allowsDecimalQuantity: true,
    categoryName: "Artículo manual",
    quickAccess: false,
    quantity,
    isManual: true
  } as any;
}

function isValidQuantity(quantity: string, item: CartItem, allowNegativeStock: boolean) {
  const value = safeNumber(quantity);
  if (item.isManual) {
    return value > 0;
  }
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

function mercadoPagoAttemptOriginLabel(origin: string) {
  const labels: Record<string, string> = {
    QR_ORDER: "QR por venta",
    AMOUNT_MATCH: "Coincidencia por monto",
    MANUAL_REFERENCE: "Cobro reciente"
  };

  return labels[origin] ?? origin;
}

function isMercadoPagoMovementApproved(movement: MercadoPagoMovementView) {
  return ["approved", "accredited", "paid"].includes(movement.status.toLowerCase());
}

function normalizeMercadoPagoPollSeconds(value: number | null | undefined) {
  return Math.max(5, Math.min(Math.trunc(value ?? 5), 30));
}

function getPreferredMercadoPagoAccountId(
  accounts: MercadoPagoAccountView[],
  preferredId: string | null | undefined
) {
  if (preferredId && accounts.some((account) => account.id === preferredId)) {
    return preferredId;
  }

  return (
    accounts.find((account) => account.defaultAccount)?.id ??
    accounts[0]?.id ??
    ""
  );
}

function resolveMercadoPagoRecentRangeMinutes(value: string) {
  if (value === "today") {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return Math.max(1, Math.ceil((now.getTime() - startOfDay.getTime()) / 60000));
  }

  const minutes = Number(value);
  return [10, 30, 120].includes(minutes) ? minutes : 10;
}

function normalizeMercadoPagoRecentLimit(value: string) {
  const limit = Number(value);
  return [5, 10, 20].includes(limit) ? limit : 5;
}

function isValidRecentRangeValue(value: string | null): value is string {
  return Boolean(value && ["10", "30", "120", "today"].includes(value));
}

function isValidRecentLimitValue(value: string | null): value is string {
  return Boolean(value && ["5", "10", "20"].includes(value));
}

function isValidRecentRefreshValue(value: string | null): value is string {
  return Boolean(value && ["0", "5", "10", "15"].includes(value));
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

  return formatStableArgentinaDateTime(date);
}

function formatMercadoPagoClock(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${padDatePart(argentinaTime.getUTCHours())}:${padDatePart(
    argentinaTime.getUTCMinutes()
  )}:${padDatePart(argentinaTime.getUTCSeconds())}`;
}

function formatStableArgentinaDateTime(date: Date) {
  const argentinaTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return [
    `${padDatePart(argentinaTime.getUTCDate())}/${padDatePart(
      argentinaTime.getUTCMonth() + 1
    )}`,
    `${padDatePart(argentinaTime.getUTCHours())}:${padDatePart(
      argentinaTime.getUTCMinutes()
    )}`
  ].join(" ");
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
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
  } else if (
    (payment.method === "MERCADOPAGO" || payment.method === "TRANSFER") &&
    payment.mercadoPagoAccountName
  ) {
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

function formatSalePaymentSummary(
  payments: PaymentEntry[],
  paymentLabels: Record<PaymentMethodValue, string>
) {
  if (payments.length === 0) {
    return "Sin pago registrado";
  }

  const methods = [...new Set(payments.map((payment) => payment.method))];
  if (methods.length === 1) {
    return paymentLabels[methods[0]];
  }

  return methods.map((method) => paymentLabels[method]).join(" + ");
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

function createOfflineOperationId() {
  return globalThis.crypto?.randomUUID() ?? `offline_${Date.now()}_${Math.random()}`;
}
