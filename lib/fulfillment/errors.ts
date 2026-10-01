export const FULFILLMENT_ERROR_CODES = [
  "FULFILLMENT_NOT_ELIGIBLE",
  "FULFILLMENT_ALREADY_EXISTS",
  "FULFILLMENT_INVALID_STATE",
  "FULFILLMENT_INVALID_TRANSITION",
  "FULFILLMENT_PROVIDER_UNSUPPORTED",
  "FULFILLMENT_PROVIDER_NOT_CONFIGURED",
  "FULFILLMENT_ITEM_INVALID",
  "FULFILLMENT_CONCURRENCY_CONFLICT",
  "FULFILLMENT_IDEMPOTENCY_CONFLICT",
  "FULFILLMENT_ORDER_NOT_FOUND",
  "FULFILLMENT_DATABASE_ERROR",
  "FULFILLMENT_PROVIDER_SUBMISSION_FAILED",
  "FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED",
] as const;
export type FulfillmentErrorCode = (typeof FULFILLMENT_ERROR_CODES)[number];

export class FulfillmentDomainError extends Error {
  constructor(public readonly code: FulfillmentErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FulfillmentDomainError";
  }
}
