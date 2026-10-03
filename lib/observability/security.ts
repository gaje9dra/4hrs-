import { incrementMetric } from "@/lib/observability/metrics";
import { logger, type LogContext } from "@/lib/observability/logger";

export type SecurityEvent = "authentication.failed" | "authorization.denied" | "webhook.rejected" | "rate_limit.triggered" | "csrf.rejected" | "provider.authentication.failed";

export function recordSecurityEvent(event: SecurityEvent, context: LogContext = {}, data?: unknown): void {
  incrementMetric("security_events_total", { operation: event });
  logger.warn(event, { ...context, outcome: "rejected" }, data);
}
