export type AdminErrorCode =
  | "ADMIN_REQUIRED" | "FORBIDDEN" | "INVALID_REQUEST" | "NOT_FOUND"
  | "CONFLICT" | "RATE_LIMITED" | "DATABASE_ERROR";
export class AdminError extends Error {
  constructor(public readonly code: AdminErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AdminError";
  }
}