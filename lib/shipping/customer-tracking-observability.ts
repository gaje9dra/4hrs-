import { logShippingObservation } from "@/lib/shipping/observability";

export function logCustomerTrackingRequest(input: {
  customerId?: string;
  shipmentReference?: string;
  result: "success" | "not-found" | "unauthorized" | "failure";
  durationMs: number;
}) {
  logShippingObservation({
    operation:
      input.result === "unauthorized"
        ? "customer-tracking-unauthorized"
        : input.result === "not-found"
          ? "customer-tracking-not-found"
          : "customer-tracking-request",
    result: input.result,
    shipmentId: input.shipmentReference,
    orderId: undefined,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    correlationId: undefined,
  });
}
