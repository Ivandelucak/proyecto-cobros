import type {
  MercadoPagoEnvironment,
  PaymentAttemptOrigin,
  PaymentAttemptStatus
} from "@prisma/client";

export type MercadoPagoAccountView = {
  id: string;
  name: string;
  enabled: boolean;
  environment: MercadoPagoEnvironment;
  publicKey: string | null;
  collectorId: string | null;
  storeId: string | null;
  externalStoreId: string | null;
  storeName: string | null;
  posId: string | null;
  externalPosId: string | null;
  posName: string | null;
  posCategory: string | null;
  posCreatedAt: string | null;
  lastPosSetupAt: string | null;
  lastPosSetupStep: string | null;
  lastPosSetupStatus: string | null;
  lastPosSetupError: string | null;
  defaultAccount: boolean;
  instructions: string | null;
  enableAmountMatching: boolean;
  amountMatchingWindowMinutes: number;
  amountMatchingTolerance: string;
  amountMatchingAutoApprove: boolean;
  amountMatchingPollSeconds: number;
  showRecentMovements: boolean;
  hasAccessToken: boolean;
};

export type MercadoPagoMovementView = {
  id: string;
  amount: string;
  status: string;
  statusDetail: string | null;
  dateApproved: string | null;
  dateCreated: string | null;
  externalReference: string | null;
  description: string | null;
  payerLabel: string | null;
  paymentMethod: string | null;
  paymentType: string | null;
  operationType: string | null;
  rawSummary: Record<string, unknown>;
  alreadyUsed: boolean;
};

export type MercadoPagoAttemptView = {
  id: string;
  accountId: string;
  accountName: string;
  amount: string;
  externalReference: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentAttemptStatus;
  origin: PaymentAttemptOrigin;
  qrData: string | null;
  qrCodeDataUrl: string | null;
  checkoutUrl: string | null;
  rawStatus: string | null;
  rawStatusDetail: string | null;
  approvedAt: string | null;
};

export type MercadoPagoApiPayment = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  amount?: string | number;
};

export type MercadoPagoOrderResponse = {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  type_response?: {
    qr_data?: string;
  };
  transactions?: {
    payments?: MercadoPagoApiPayment[];
  };
};

export type MercadoPagoPaymentSearchResult = {
  id?: string | number;
  transaction_amount?: number;
  total_paid_amount?: number;
  status?: string;
  status_detail?: string;
  date_created?: string;
  date_approved?: string;
  date_last_updated?: string;
  external_reference?: string;
  description?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  operation_type?: string;
  payer?: {
    id?: string | number;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
};
