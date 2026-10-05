import { AuthenticationError } from "@/lib/auth/errors";
import { PaymentError, type PaymentErrorCode } from "@/lib/payments/errors";
import { incrementMetric } from "@/lib/observability/metrics";
import { reportError } from "@/lib/observability/errors";

const STATUS: Record<PaymentErrorCode | "SESSION_INVALID", number> = {
  UNAUTHENTICATED: 401,
  SESSION_INVALID: 401,
  UNAUTHORIZED_CHECKOUT: 404,
  PAYMENT_OWNERSHIP_VIOLATION: 404,
  PAYMENT_NOT_FOUND: 404,
  INVALID_PAYMENT_REQUEST: 400,
  INVALID_CHECKOUT: 409,
  STALE_CHECKOUT: 409,
  EXPIRED_CHECKOUT: 409,
  CHECKOUT_NOT_PAYABLE: 409,
  INVALID_AMOUNT: 409,
  INVALID_CURRENCY: 409,
  PAYMENT_ALREADY_COMPLETED: 409,
  PAYMENT_ALREADY_TERMINAL: 409,
  INVALID_STATE_TRANSITION: 409,
  DUPLICATE_IDEMPOTENCY_KEY: 409,
  IDEMPOTENCY_CONFLICT: 409,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_CONFIGURATION_MISSING: 503,
  PROVIDER_REJECTED: 402,
  PROVIDER_CONFIGURATION_ERROR: 503,
  PROVIDER_TIMEOUT: 503,
  PROVIDER_NETWORK_ERROR: 503,
  PAYMENT_DECLINED: 402,
  PAYMENT_REQUIRES_ACTION: 409,
  PAYMENT_INVALID_REQUEST: 400,
  PROVIDER_UNKNOWN_ERROR: 503,
  WEBHOOK_VERIFICATION_FAILED: 400,
  PAYMENT_INTERNAL_ERROR: 503,
  PAYMENT_RATE_LIMITED: 429,
};

export function paymentJson<T>(data: T, status = 200): Response {
  incrementMetric("payment_operations_total", { operation: "http", status_class: `${Math.floor(status / 100)}xx` });
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie, Authorization",
    },
  });
}

export function paymentErrorResponse(error: unknown): Response {
  incrementMetric("payment_operations_total", { operation: "error", error_class: error instanceof PaymentError ? error.code : error instanceof AuthenticationError ? "authentication" : "unexpected" });
  reportError(error, { outcome: "failure", resourceType: "payment" });
  const code = error instanceof AuthenticationError
    ? "SESSION_INVALID"
    : error instanceof PaymentError
      ? error.code
      : "PAYMENT_INTERNAL_ERROR";
  const message = error instanceof AuthenticationError
    ? "Authentication is required."
    : error instanceof PaymentError
      ? error.message
      : "Payment operation is temporarily unavailable.";
  return paymentJson({ error: { code, message } }, STATUS[code]);
}

export function paymentMethodNotAllowed(allowed: string[]): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allowed.join(", "),
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Authorization",
    },
  });
}
