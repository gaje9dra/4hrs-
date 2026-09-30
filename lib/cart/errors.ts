export type CartErrorCode =
  | "CART_NOT_FOUND"
  | "CART_OWNERSHIP_UNAVAILABLE"
  | "CART_UNAUTHORIZED"
  | "CART_ITEM_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_NOT_FOUND"
  | "INVALID_VARIANT"
  | "INVALID_QUANTITY"
  | "INSUFFICIENT_AVAILABILITY"
  | "INVALID_CART_STATE"
  | "CART_ITEM_CONFLICT"
  | "INVALID_CART_INPUT"
  | "CART_DATABASE_ERROR";

export type CartErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export class CartServiceError extends Error {
  readonly code: CartErrorCode;
  readonly details?: CartErrorDetails;
  readonly cause?: unknown;

  constructor(code: CartErrorCode, message: string, details?: CartErrorDetails, cause?: unknown) {
    super(message);
    this.name = "CartServiceError";
    this.code = code;
    this.details = details;
    this.cause = cause;
  }
}
