import { AuthenticationError, isAuthenticationError } from "@/lib/auth/errors";
import { OrderDomainError, type OrderErrorCode } from "@/lib/orders/errors";
import { logOrderCreationObservation } from "@/lib/orders/observability";

const STATUS: Record<OrderErrorCode, number> = {
  PAYMENT_NOT_FOUND: 404,
  PAYMENT_NOT_VERIFIED: 409,
  PAYMENT_ACCESS_DENIED: 404,
  PAYMENT_ALREADY_CONVERTED: 409,
  CHECKOUT_NOT_FOUND: 404,
  CHECKOUT_INVALID: 409,
  CHECKOUT_ALREADY_CONVERTED: 409,
  ORDER_ALREADY_EXISTS: 409,
  CHECKOUT_PAYMENT_MISMATCH: 409,
  AMOUNT_MISMATCH: 409,
  CURRENCY_MISMATCH: 409,
  ADDRESS_NOT_FOUND: 409,
  ADDRESS_ACCESS_DENIED: 404,
  INVALID_ORDER_ITEM: 409,
  ORDER_CREATION_FAILED: 503,
  ORDER_NOT_FOUND: 404,
  ORDER_INVALID_REQUEST: 400,
  ORDER_DATABASE_ERROR: 503,
  ORDER_CONCURRENCY_CONFLICT: 409,
  ORDER_IDEMPOTENCY_CONFLICT: 409,
};

export function orderJson<T>(data: T, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function orderErrorResponse(error: unknown, operation: "create" | "get" | "list"): Response {
  const isAuth = isAuthenticationError(error);
  const isOrder = error instanceof OrderDomainError;
  const code = isAuth ? "SESSION_INVALID" : isOrder ? error.code : "ORDER_DATABASE_ERROR";
  const status = isAuth ? 401 : STATUS[code];
  const message = isAuth
    ? "Authentication is required."
    : isOrder
      ? error.message
      : "Order information is temporarily unavailable.";

  if (isOrder && operation === "create") {
    logOrderCreationObservation({
      operation: "create-from-payment",
      result: "failure",
      failureCode: error.code,
      durationMs: 0,
    });
  }

  return orderJson({ error: { code, message } }, status);
}

export function orderMethodNotAllowed(allowed: string[]): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allowed.join(", "),
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie, Authorization",
    },
  });
}

export function assertOrderSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestUrl = new URL(request.url);
  if (origin !== requestUrl.origin) {
    throw new AuthenticationError("CSRF_REJECTED", "The Order request is not allowed.");
  }
}
