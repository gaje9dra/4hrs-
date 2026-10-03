import type { FulfillmentErrorCode } from "@/lib/fulfillment/errors";
import { incrementMetric } from "@/lib/observability/metrics";
import { logger } from "@/lib/observability/logger";

export type FulfillmentObservation = Readonly<{
  operation: "eligibility" | "create" | "transition" | "provider-resolution" | "mapping" | "reconcile";
  fulfillmentId?: string;
  orderId?: string;
  provider?: string;
  from?: string;
  to?: string;
  result: "success" | "failure" | "conflict";
  failureCode?: FulfillmentErrorCode;
  durationMs?: number;
}>;

export function logFulfillmentObservation(observation: FulfillmentObservation): void {
  incrementMetric("fulfillment_operations_total", {
    operation: observation.operation,
    provider: observation.provider ?? "none",
    metric: observation.result,
  });
  logger[observation.result === "success" ? "info" : "warn"]("fulfillment.operation", {
    resourceType: "fulfillment",
    resourceId: observation.fulfillmentId,
    correlationId: undefined,
    provider: observation.provider,
    durationMs: observation.durationMs,
    outcome: observation.result === "success" ? "success" : "failure",
    errorCode: observation.failureCode,
  }, {
    operation: observation.operation,
    orderId: observation.orderId,
    from: observation.from,
    to: observation.to,
  });
}
