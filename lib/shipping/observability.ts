import type { ShippingErrorCode } from "@/lib/shipping/errors";

export type ShippingObservation = Readonly<{
  operation:
    | "handoff"
    | "shipment-create"
    | "state-transition"
    | "tracking-event"
    | "reconciliation";
  shipmentId?: string;
  fulfillmentId?: string;
  orderId?: string;
  providerId?: string;
  result: "success" | "duplicate" | "history-only" | "failure" | "reconciliation-required";
  from?: string;
  to?: string;
  errorCode?: ShippingErrorCode;
  durationMs?: number;
  correlationId?: string;
  retryClassification?: string;
}>;

export function logShippingObservation(observation: ShippingObservation): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    scope: "shipping",
    operation: observation.operation,
    shipmentId: observation.shipmentId,
    fulfillmentId: observation.fulfillmentId,
    orderId: observation.orderId,
    providerId: observation.providerId,
    result: observation.result,
    from: observation.from,
    to: observation.to,
    errorCode: observation.errorCode,
    durationMs: observation.durationMs === undefined ? undefined : Math.round(observation.durationMs),
    correlationId: observation.correlationId,
    retryClassification: observation.retryClassification,
  };
  if (observation.result === "success" || observation.result === "duplicate" || observation.result === "history-only") {
    console.info("[shipping]", payload);
  } else {
    console.warn("[shipping]", payload);
  }
}
