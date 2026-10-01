export type CheckoutErrorCode =
  | "CHECKOUT_UNAUTHENTICATED" | "CHECKOUT_CART_MISSING" | "CHECKOUT_CART_EMPTY"
  | "CHECKOUT_INVALID_CART" | "CHECKOUT_PRODUCT_UNAVAILABLE" | "CHECKOUT_VARIANT_UNAVAILABLE"
  | "CHECKOUT_INVALID_QUANTITY" | "CHECKOUT_PRICE_CHANGED" | "CHECKOUT_CURRENCY_CHANGED"
  | "CHECKOUT_INVALID_ADDRESS" | "CHECKOUT_ADDRESS_NOT_OWNED" | "CHECKOUT_ADDRESS_NOT_FOUND"
  | "CHECKOUT_INCOMPLETE" | "CHECKOUT_UNSUPPORTED_STATE" | "CHECKOUT_DATABASE_ERROR";

export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
    public readonly details?: Readonly<Record<string, string | number | boolean | null>>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CheckoutError";
  }
}
