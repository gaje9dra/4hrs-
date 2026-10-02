import type { NormalizedTrackingEvent, ShippingProviderAdapter } from "@/lib/shipping/contracts";

/**
 * Qikink is a fulfillment provider in 4HRS+. Its public material verifies
 * dashboard tracking and shipment statuses, but the provider API contract
 * used by this application does not expose a verified machine-to-machine
 * tracking/status or webhook operation. This adapter therefore declares
 * those capabilities unavailable and never fabricates tracking data.
 */
export const qikinkShippingProvider: ShippingProviderAdapter = {
  id: "qikink",
  capabilities: {
    createShipment: false,
    trackingLookup: false,
    webhooks: false,
  },
  normalizeTrackingEvent(_input: unknown): NormalizedTrackingEvent {
    throw new Error("Qikink tracking-event normalization is unavailable until a verified provider event contract exists.");
  },
};
