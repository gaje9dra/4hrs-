import type { ShippingErrorCode } from "@/lib/shipping/errors";
import { incrementMetric } from "@/lib/observability/metrics";
import { logger } from "@/lib/observability/logger";

export type ShippingObservation = Readonly<{
  operation: "handoff" | "shipment-create" | "state-transition" | "tracking-event" | "reconciliation" | "customer-tracking-request" | "customer-tracking-unauthorized" | "customer-tracking-not-found";
  shipmentId?: string;
  fulfillmentId?: string;
  orderId?: string;
  providerId?: string;
  result: "success" | "duplicate" | "history-only" | "failure" | "reconciliation-required" | "not-found" | "unauthorized";
  from?: string;
  to?: string;
  errorCode?: ShippingErrorCode;
  durationMs?: number;
  correlationId?: string;
  retryClassification?: string;
}>;

export function logShippingObservation(observation: ShippingObservation): void {
  incrementMetric("shipping_operations_total", {
    operation: observation.operation,
    provider: observation.providerId ?? "none",
    metric: observation.result,
  });
  logger[["success", "duplicate", "history-only"].includes(observation.result) ? "info" : "warn"]("shipping.operation", {
    resourceType: "shipment",
    resourceId: observation.shipmentId,
    correlationId: observation.correlationId,
    provider: observation.providerId,
    durationMs: observation.durationMs,
    outcome: observation.result === "success" ? "success" : observation.result === "failure" ? "failure" : "rejected",
    errorCode: observation.errorCode,
  }, {
    operation: observation.operation,
    fulfillmentId: observation.fulfillmentId,
    orderId: observation.orderId,
    from: observation.from,
    to: observation.to,
    retryClassification: observation.retryClassification,
  });
}
