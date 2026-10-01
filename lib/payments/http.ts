import { AuthenticationError } from "@/lib/auth/errors";
import { PaymentError, type PaymentErrorCode } from "@/lib/payments/errors";

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
  WEBHOOK_VERIFICATION_FAILED: 400,
  PAYMENT_INTERNAL_ERROR: 503,
};

export function paymentJson<T>(data: T, status = 200): Response {
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
