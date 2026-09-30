import { CartServiceError, type CartErrorCode } from "@/lib/cart/errors";
import { logCartObservation } from "@/lib/cart/observability";

const ERROR_STATUS: Record<CartErrorCode, number> = {
  CART_NOT_FOUND: 404,
  CART_OWNERSHIP_UNAVAILABLE: 503,
  CART_UNAUTHORIZED: 403,
  CART_ITEM_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  VARIANT_NOT_FOUND: 404,
  INVALID_VARIANT: 422,
  INVALID_QUANTITY: 400,
  INSUFFICIENT_AVAILABILITY: 409,
  INVALID_CART_STATE: 409,
  CART_ITEM_CONFLICT: 409,
  INVALID_CART_INPUT: 400,
  CART_DATABASE_ERROR: 503,
};

export type CartErrorResponse = {
  error: {
    code: CartErrorCode | "INTERNAL_SERVER_ERROR";
    message: string;
  };
};

export function cartJson<T>(data: T, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie, Authorization",
    },
  });
}

export function cartErrorResponse(error: unknown, operation: string): Response {
  const startedAt = Date.now();
  const isDomainError = error instanceof CartServiceError;
  const code = isDomainError ? error.code : "INTERNAL_SERVER_ERROR";
  const status = isDomainError ? ERROR_STATUS[error.code] : 500;

  logCartObservation({
    operation,
    classification: isDomainError
      ? error.code === "CART_OWNERSHIP_UNAVAILABLE" || error.code === "CART_UNAUTHORIZED"
        ? "ownership_failure"
        : error.code === "CART_DATABASE_ERROR"
          ? "persistence_failure"
          : error.code.startsWith("INVALID_")
            ? "validation_failure"
            : "domain_failure"
      : "unexpected_failure",
    durationMs: Date.now() - startedAt,
    errorCode: isDomainError ? error.code : undefined,
  });

  const payload: CartErrorResponse = {
    error: {
      code,
      message: isDomainError ? error.message : "An unexpected server error occurred.",
    },
  };

  return cartJson(payload, status);
}

export function methodNotAllowed(allowed: string[]): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allowed.join(", "),
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Authorization",
    },
  });
}
