export type PaymentErrorCode =
  | "INVALID_CHECKOUT"
  | "AUTHORIZATION_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_REJECTED"
  | "PAYMENT_REQUIRES_ACTION"
  | "PAYMENT_FAILED"
  | "WEBHOOK_VERIFICATION_FAILED"
  | "DUPLICATE_REQUEST"
  | "IDEMPOTENCY_CONFLICT"
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
