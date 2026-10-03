import { incrementMetric } from "@/lib/observability/metrics";
import { logger } from "@/lib/observability/logger";

export function recordNotificationOperation(operation: string, context: { deliveryId?: string; provider?: string; outcome?: "success"|"failure"|"timeout"|"rejected"; correlationId?: string | null } = {}) {
  incrementMetric("notification_operations_total" as never, { operation, provider: context.provider ?? "none" });
  logger.info("notification.operation", { operationId: context.deliveryId, correlationId: context.correlationId, provider: context.provider, outcome: context.outcome });
}