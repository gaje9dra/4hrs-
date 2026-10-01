import { AuthenticationError } from "@/lib/auth/errors";
import { CheckoutError, type CheckoutErrorCode } from "@/lib/checkout/errors";
import { logCheckoutObservation } from "@/lib/checkout/observability";

const ERROR_STATUS: Record<CheckoutErrorCode | "SESSION_INVALID", number> = {
  CHECKOUT_UNAUTHENTICATED: 401, CHECKOUT_CART_MISSING: 404, CHECKOUT_CART_EMPTY: 409,
  CHECKOUT_INVALID_CART: 409, CHECKOUT_PRODUCT_UNAVAILABLE: 409, CHECKOUT_VARIANT_UNAVAILABLE: 409,
  CHECKOUT_INVALID_QUANTITY: 409, CHECKOUT_PRICE_CHANGED: 409, CHECKOUT_CURRENCY_CHANGED: 409,
  CHECKOUT_INVALID_ADDRESS: 422, CHECKOUT_ADDRESS_NOT_OWNED: 404, CHECKOUT_ADDRESS_NOT_FOUND: 404,
  CHECKOUT_INCOMPLETE: 400, CHECKOUT_UNSUPPORTED_STATE: 409, CHECKOUT_DATABASE_ERROR: 503,
  SESSION_INVALID: 401,
};

export function checkoutJson<T>(data: T, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie, Authorization" },
  });
}

export function checkoutErrorResponse(error: unknown, operation: string): Response {
  const isAuth = error instanceof AuthenticationError;
  const isCheckout = error instanceof CheckoutError;
  const code = isAuth ? "SESSION_INVALID" : isCheckout ? error.code : "CHECKOUT_DATABASE_ERROR";
  logCheckoutObservation({
    operation,
    classification: isAuth ? "authorization_failure" : isCheckout ? "validation_failure" : "unexpected_failure",
    durationMs: 0,
    errorCode: isCheckout ? error.code : undefined,
  });
  return checkoutJson({
    error: {
      code,
      message: isAuth ? "Authentication is required." : isCheckout ? error.message : "Checkout validation is temporarily unavailable.",
    },
  }, ERROR_STATUS[code]);
}

export function methodNotAllowed(allowed: string[]): Response {
  return new Response(null, { status: 405, headers: { Allow: allowed.join(", "), "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
}
