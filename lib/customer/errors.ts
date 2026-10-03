export type CustomerIdentityErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_DUPLICATE_EMAIL"
  | "CUSTOMER_INVALID_EMAIL"
  | "CUSTOMER_INVALID_STATUS"
  | "CUSTOMER_DATABASE_ERROR"
  | "CUSTOMER_SESSION_NOT_FOUND";

export class CustomerIdentityError extends Error {
  constructor(
    public readonly code: CustomerIdentityErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CustomerIdentityError";
  }
}

export function isCustomerError(error: unknown): error is CustomerIdentityError {
  return error instanceof CustomerIdentityError;
}

export function createCustomerError(code: CustomerIdentityErrorCode, message: string): CustomerIdentityError {
  return new CustomerIdentityError(code, message);
}

export type CustomerAddressErrorCode =
  | "CUSTOMER_ADDRESS_NOT_FOUND"
  | "CUSTOMER_ADDRESS_INVALID"
  | "CUSTOMER_ADDRESS_DATABASE_ERROR";

export class CustomerAddressError extends Error {
  constructor(
    public readonly code: CustomerAddressErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CustomerAddressError";
  }
}
