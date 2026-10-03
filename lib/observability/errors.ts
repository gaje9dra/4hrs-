import { logger, type LogContext } from "@/lib/observability/logger";

export type ErrorClass =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "conflict"
  | "idempotency_conflict"
  | "business_rule"
  | "dependency"
  | "provider"
  | "database"
  | "timeout"
  | "rate_limit"
  | "webhook_verification"
  | "unexpected";

export function classifyError(error: unknown): ErrorClass {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (/VALIDATION|INVALID_INPUT|INVALID_REQUEST/.test(code)) return "validation";
  if (/AUTH|SESSION|CREDENTIAL/.test(code)) return "authentication";
  if (/FORBIDDEN|UNAUTHORIZED|ADMIN_REQUIRED/.test(code)) return "authorization";
  if (/NOT_FOUND/.test(code)) return "not_found";
  if (/IDEMPOT|CONFLICT|ALREADY_EXISTS/.test(code)) return "conflict";
  if (/BUSINESS|INELIGIBLE|STALE/.test(code)) return "business_rule";
  if (/TIMEOUT/.test(code)) return "timeout";
  if (/RATE_LIMIT/.test(code)) return "rate_limit";
  if (/WEBHOOK|SIGNATURE|REPLAY/.test(code)) return "webhook_verification";
  if (/PROVIDER|QIKINK/.test(code)) return "provider";
  if (/DATABASE|PRISMA|DB_/.test(code)) return "database";
  if (error instanceof Error && /timeout/i.test(error.message)) return "timeout";
  if (error instanceof Error && /prisma|database/i.test(error.message)) return "database";
  return "unexpected";
}

export function reportError(error: unknown, context: LogContext = {}): { errorClass: ErrorClass; errorCode: string } {
  const errorClass = classifyError(error);
  const errorCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "UNEXPECTED_ERROR")
    : "UNEXPECTED_ERROR";
  logger.error("error.reported", { ...context, errorCode, outcome: "failure" }, {
    errorClass,
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });
  return { errorClass, errorCode };
}
