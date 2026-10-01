export const PAYMENT_STATUSES = [
  "CREATED",
  "REQUIRES_ACTION",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentAmount = {
  value: string;
  currency: string;
};

export type PaymentIntent = {
  id: string;
  customerId: string;
  checkoutReference: string;
  amount: PaymentAmount;
  providerId: string;
  status: PaymentStatus;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentAttempt = {
  id: string;
  paymentId: string;
  attemptNumber: number;
  status: PaymentStatus;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentResult = {
  paymentId: string;
  status: PaymentStatus;
  amount: PaymentAmount;
  providerId: string;
  providerReference: string | null;
};

const transitions: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  CREATED: ["REQUIRES_ACTION", "PROCESSING", "FAILED", "CANCELLED", "EXPIRED"],
  REQUIRES_ACTION: ["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"],
  PROCESSING: ["REQUIRES_ACTION", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"],
  FAILED: ["REQUIRES_ACTION", "PROCESSING", "CANCELLED", "EXPIRED"],
  SUCCEEDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): void {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED";
}

export function canRetryPayment(status: PaymentStatus): boolean {
  return status === "FAILED";
}

export function normalizePaymentProviderStatus(
  status: PaymentStatus,
): PaymentStatus {
  return status;
}
