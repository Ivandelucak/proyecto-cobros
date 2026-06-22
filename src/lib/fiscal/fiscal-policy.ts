import { FiscalIssueMode, FiscalStatus, PaymentMethod } from "@prisma/client";
import type { FiscalSettingView } from "@/lib/fiscal/fiscal-settings";

type DetermineFiscalRequirementInput = {
  payments: Array<{ method: PaymentMethod }>;
  setting: FiscalSettingView;
  cashierRequestedInvoice?: boolean | null;
};

export type FiscalRequirementDecision = {
  requiresFiscalInvoice: boolean;
  fiscalStatus: FiscalStatus;
  fiscalRequestedAt: Date | null;
  decisionSource: "DISABLED" | "ELECTRONIC_PAYMENT" | "CURRENT_ACCOUNT" | "CASH" | "MIXED";
};

const electronicPaymentMethods = new Set<PaymentMethod>([
  PaymentMethod.DEBIT,
  PaymentMethod.CREDIT,
  PaymentMethod.TRANSFER,
  PaymentMethod.MERCADOPAGO
]);

export function determineFiscalRequirementForSale({
  payments,
  setting,
  cashierRequestedInvoice = null
}: DetermineFiscalRequirementInput): FiscalRequirementDecision {
  if (!setting.enabled) {
    return buildDecision(FiscalIssueMode.NEVER, "DISABLED", cashierRequestedInvoice);
  }

  const methods = new Set(payments.map((payment) => payment.method));
  const hasElectronicPayment = [...methods].some((method) =>
    electronicPaymentMethods.has(method)
  );
  const hasCurrentAccount = methods.has(PaymentMethod.CURRENT_ACCOUNT);
  const hasCash = methods.has(PaymentMethod.CASH);

  if (hasElectronicPayment) {
    return buildDecision(
      setting.electronicPaymentIssueMode,
      methods.size > 1 ? "MIXED" : "ELECTRONIC_PAYMENT",
      cashierRequestedInvoice
    );
  }

  if (hasCurrentAccount) {
    return buildDecision(
      setting.currentAccountIssueMode,
      methods.size > 1 ? "MIXED" : "CURRENT_ACCOUNT",
      cashierRequestedInvoice
    );
  }

  if (hasCash) {
    return buildDecision(setting.cashIssueMode, "CASH", cashierRequestedInvoice);
  }

  return buildDecision(FiscalIssueMode.NEVER, "MIXED", cashierRequestedInvoice);
}

export function shouldAskFiscalDecision(
  setting: FiscalSettingView,
  paymentMethods: PaymentMethod[]
) {
  if (!setting.enabled) {
    return false;
  }

  const hasElectronicPayment = paymentMethods.some((method) =>
    electronicPaymentMethods.has(method)
  );
  const hasCurrentAccount = paymentMethods.includes(PaymentMethod.CURRENT_ACCOUNT);

  if (hasElectronicPayment) {
    return setting.electronicPaymentIssueMode === FiscalIssueMode.ASK;
  }

  if (hasCurrentAccount) {
    return setting.currentAccountIssueMode === FiscalIssueMode.ASK;
  }

  return setting.cashIssueMode === FiscalIssueMode.ASK;
}

export function willAutoMarkFiscalPending(
  setting: FiscalSettingView,
  paymentMethods: PaymentMethod[]
) {
  if (!setting.enabled) {
    return false;
  }

  const hasElectronicPayment = paymentMethods.some((method) =>
    electronicPaymentMethods.has(method)
  );
  const hasCurrentAccount = paymentMethods.includes(PaymentMethod.CURRENT_ACCOUNT);

  if (hasElectronicPayment) {
    return setting.electronicPaymentIssueMode === FiscalIssueMode.AUTO;
  }

  if (hasCurrentAccount) {
    return setting.currentAccountIssueMode === FiscalIssueMode.AUTO;
  }

  return setting.cashIssueMode === FiscalIssueMode.AUTO;
}

export function isElectronicFiscalPaymentMethod(method: PaymentMethod) {
  return electronicPaymentMethods.has(method);
}

function buildDecision(
  mode: FiscalIssueMode,
  decisionSource: FiscalRequirementDecision["decisionSource"],
  cashierRequestedInvoice: boolean | null
): FiscalRequirementDecision {
  const shouldRequest =
    mode === FiscalIssueMode.AUTO ||
    (mode === FiscalIssueMode.ASK && cashierRequestedInvoice === true);

  return {
    requiresFiscalInvoice: shouldRequest,
    fiscalStatus: shouldRequest ? FiscalStatus.PENDING : FiscalStatus.NOT_REQUESTED,
    fiscalRequestedAt: shouldRequest ? new Date() : null,
    decisionSource
  };
}
