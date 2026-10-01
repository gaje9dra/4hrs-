export const ORDER_ERROR_CODES = [
  "PAYMENT_NOT_FOUND",
  "PAYMENT_NOT_VERIFIED",
  "PAYMENT_ACCESS_DENIED",
  "PAYMENT_ALREADY_CONVERTED",
  "CHECKOUT_NOT_FOUND",
  "CHECKOUT_INVALID",
  "CHECKOUT_ALREADY_CONVERTED",
  "ORDER_ALREADY_EXISTS",
  "CHECKOUT_PAYMENT_MISMATCH",
  "AMOUNT_MISMATCH",
  "CURRENCY_MISMATCH",
  "ADDRESS_NOT_FOUND",
  "ADDRESS_ACCESS_DENIED",
  "INVALID_ORDER_ITEM",
  "ORDER_CREATION_FAILED",
] as const;

export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number];

export class OrderDomainError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    message: string,
    public readonly details?: Readonly<Record<string, string | number | boolean | null>>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "OrderDomainError";
  }
}
