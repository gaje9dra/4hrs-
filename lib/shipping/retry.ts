export const SHIPPING_RETRY_CLASSES = [
  "VALIDATION",
  "AUTHENTICATION",
  "AUTHORIZATION",
  "RATE_LIMIT",
  "PROVIDER_4XX",
  "PROVIDER_5XX",
  "NETWORK",
  "TIMEOUT",
  "AMBIGUOUS",
] as const;

export type ShippingRetryClass = (typeof SHIPPING_RETRY_CLASSES)[number];

export type ShippingRetryDecision = Readonly<{
  retryable: boolean;
  classification: ShippingRetryClass;
}>;

/**
 * Provider-neutral retry policy. Shipment creation is never automatically
 * retried for an ambiguous outcome because the current qualified providers
 * do not establish safe duplicate-creation semantics.
 */
export function classifyShippingRetry(input: {
  classification: ShippingRetryClass;
  operation: "SHIPMENT_CREATE" | "TRACKING_LOOKUP" | "RECONCILIATION";
}): ShippingRetryDecision {
  if (input.classification === "AMBIGUOUS") {
    return { retryable: false, classification: input.classification };
  }

  if (input.classification === "VALIDATION"
    || input.classification === "AUTHENTICATION"
    || input.classification === "AUTHORIZATION"
    || input.classification === "PROVIDER_4XX") {
    return { retryable: false, classification: input.classification };
  }

  if (input.classification === "RATE_LIMIT"
    || input.classification === "PROVIDER_5XX"
    || input.classification === "NETWORK"
    || input.classification === "TIMEOUT") {
    return {
      retryable: input.operation !== "SHIPMENT_CREATE",
      classification: input.classification,
    };
  }

  return { retryable: false, classification: input.classification };
}

export function shippingRetryDelayMs(
  attempt: number,
  options: Readonly<{
    baseMs?: number;
    maxMs?: number;
    jitterRatio?: number;
    random?: () => number;
  }> = {},
): number {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError("Retry attempt must be a non-negative integer.");
  }

  const baseMs = options.baseMs ?? 500;
  const maxMs = options.maxMs ?? 30_000;
  const jitterRatio = options.jitterRatio ?? 0.2;
  const random = options.random ?? Math.random;

  if (baseMs <= 0 || maxMs < baseMs || jitterRatio < 0 || jitterRatio > 1) {
    throw new RangeError("Invalid retry backoff configuration.");
  }

  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = exponential * jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(Math.min(maxMs, exponential + jitter)));
}
