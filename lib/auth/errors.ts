export type AuthenticationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_UNAVAILABLE"
  | "SESSION_INVALID"
  | "SESSION_EXPIRED"
  | "CSRF_REJECTED"
  | "RATE_LIMITED"
  | "AUTH_DATABASE_ERROR"
  | "ADMIN_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "CONFLICT";

export class AuthenticationError extends Error {
  constructor(
    public readonly code: AuthenticationErrorCode,
    message: string,
    public readonly publicMessage = message,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}
