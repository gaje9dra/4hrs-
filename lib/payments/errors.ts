export type PaymentErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED_CHECKOUT"
  | "INVALID_CHECKOUT"
  | "STALE_CHECKOUT"
  | "EXPIRED_CHECKOUT"
  | "CHECKOUT_NOT_PAYABLE"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "PAYMENT_ALREADY_COMPLETED"
  | "PAYMENT_ALREADY_TERMINAL"
  | "INVALID_STATE_TRANSITION"
  | "DUPLICATE_IDEMPOTENCY_KEY"
  | "IDEMPOTENCY_CONFLICT"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_OWNERSHIP_VIOLATION"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_CONFIGURATION_MISSING"
  | "INVALID_PAYMENT_REQUEST"
  | "PROVIDER_REJECTED"
  | "WEBHOOK_VERIFICATION_FAILED"
  | "PAYMENT_INTERNAL_ERROR";

export class PaymentError extends Error {
  constructor(
    public readonly code: PaymentErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PaymentError";
  }
}

export function paymentError(code: PaymentErrorCode, message: string, cause?: unknown): PaymentError {
  return new PaymentError(code, message, cause === undefined ? undefined : { cause });
}
