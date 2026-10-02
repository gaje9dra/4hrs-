import { AuthenticationError } from "@/lib/auth/errors";
export type AdminErrorCode = "ADMIN_REQUIRED" | "FORBIDDEN" | "INVALID_REQUEST" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "DATABASE_ERROR";
export class AdminError extends AuthenticationError {
  constructor(public readonly code: AdminErrorCode, message: string, options?: { cause?: unknown }) {
    super(code as never, message, message, options);
    this.name = "AdminError";
  }
}