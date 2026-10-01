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

export type PaymentDto = {
  id: string;
  reference: string;
  checkoutReference: string;
  status: PaymentStatus;
  amount: PaymentAmount;
  expiresAt: string | null;
  nextAction: null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentIntent = PaymentDto;

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

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return transitions[from].includes(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return status === "SUCCEEDED" || status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED";
}

export function canRetryPayment(status: PaymentStatus): boolean {
  return status === "FAILED";
}

export function validatePaymentAmount(amount: PaymentAmount): void {
  if (!/^[0-9]+(?:\\.[0-9]{1,2})?$/.test(amount.value)) {
    throw new Error("Payment amount is invalid.");
  }
  if (Number(amount.value) <= 0) throw new Error("Payment amount must be greater than zero.");
  if (!/^[A-Z]{3}$/.test(amount.currency)) throw new Error("Payment currency is invalid.");
}

export function normalizePaymentProviderStatus(status: PaymentStatus): PaymentStatus {
  return status;
}

export function paymentTransitionTable(): Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> {
  return transitions;
}
