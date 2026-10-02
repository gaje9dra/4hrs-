export const SHIPPING_ERROR_CODES = [
  "FULFILLMENT_NOT_FOUND",
  "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
  "SHIPMENT_ALREADY_EXISTS",
  "SHIPMENT_NOT_FOUND",
  "INVALID_SHIPMENT_TRANSITION",
  "TRACKING_EVENT_DUPLICATE",
  "TRACKING_EVENT_OUT_OF_ORDER",
  "UNSUPPORTED_PROVIDER_STATUS",
  "PROVIDER_SHIPMENT_NOT_FOUND",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "UNAUTHORIZED_SHIPMENT_ACCESS",
  "SHIPMENT_RECONCILIATION_REQUIRED",
  "SHIPMENT_IDEMPOTENCY_CONFLICT",
  "SHIPMENT_CONCURRENCY_CONFLICT",
  "INVALID_TRACKING_EVENT",
] as const;

export type ShippingErrorCode = (typeof SHIPPING_ERROR_CODES)[number];

export class ShippingDomainError extends Error {
  constructor(
    public readonly code: ShippingErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ShippingDomainError";
  }
}
