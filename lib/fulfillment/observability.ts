import type { FulfillmentErrorCode } from "@/lib/fulfillment/errors";

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
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    scope: "fulfillment",
    operation: observation.operation,
    fulfillmentId: observation.fulfillmentId,
    orderId: observation.orderId,
    provider: observation.provider,
    from: observation.from,
    to: observation.to,
    result: observation.result,
    failureCode: observation.failureCode,
    durationMs: observation.durationMs === undefined ? undefined : Math.round(observation.durationMs),
  };
  if (observation.result === "success") console.info("[fulfillment]", payload);
  else console.warn("[fulfillment]", payload);
}
