import { ShipmentStatus } from "@prisma/client";
import { SHIPPING_STATUSES } from "@/lib/shipping/contracts";
import { ShippingDomainError } from "@/lib/shipping/errors";

const TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  CREATED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED", "RETURNED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  DELIVERED: [],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  RETURNED: [],
};

const ORDER: Readonly<Record<ShipmentStatus, number>> = {
  CREATED: 0,
  IN_TRANSIT: 1,
  OUT_FOR_DELIVERY: 2,
  DELIVERED: 3,
  DELIVERY_FAILED: 2,
  RETURNED: 4,
};

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPPING_STATUSES as readonly string[]).includes(value);
}

export function isShipmentTerminal(status: ShipmentStatus): boolean {
  return status === "DELIVERED" || status === "RETURNED";
}

export function canTransitionShipmentStatus(current: ShipmentStatus, next: ShipmentStatus): boolean {
  return current !== next && TRANSITIONS[current].includes(next);
}

export function assertShipmentTransition(current: ShipmentStatus, next: ShipmentStatus): void {
  if (current === next) {
    throw new ShippingDomainError("INVALID_SHIPMENT_TRANSITION", "The Shipment state must change.");
  }
  if (!canTransitionShipmentStatus(current, next)) {
    throw new ShippingDomainError(
      "INVALID_SHIPMENT_TRANSITION",
      `The Shipment transition ${current} → ${next} is not allowed.`,
    );
  }
}

export function shouldApplyTrackingEvent(
  currentStatus: ShipmentStatus,
  eventStatus: ShipmentStatus,
  eventTimestamp: Date,
  latestEventTimestamp: Date | null,
): "APPLY" | "HISTORY_ONLY" | "DUPLICATE" {
  if (currentStatus === eventStatus) return "HISTORY_ONLY";
  if (isShipmentTerminal(currentStatus)) return "HISTORY_ONLY";
  if (latestEventTimestamp && eventTimestamp.getTime() < latestEventTimestamp.getTime()) {
    return ORDER[eventStatus] > ORDER[currentStatus] ? "HISTORY_ONLY" : "HISTORY_ONLY";
  }
  if (canTransitionShipmentStatus(currentStatus, eventStatus)) return "APPLY";
  if (ORDER[eventStatus] > ORDER[currentStatus]) return "APPLY";
  return "HISTORY_ONLY";
}

export function assertTrackingEventTransition(
  currentStatus: ShipmentStatus,
  nextStatus: ShipmentStatus,
): void {
  if (isShipmentTerminal(currentStatus)) {
    throw new ShippingDomainError(
      "TRACKING_EVENT_OUT_OF_ORDER",
      `Terminal Shipment state ${currentStatus} cannot be overwritten by ${nextStatus}.`,
    );
  }
  if (currentStatus === nextStatus) return;
  if (!canTransitionShipmentStatus(currentStatus, nextStatus) && ORDER[nextStatus] <= ORDER[currentStatus]) {
    throw new ShippingDomainError(
      "INVALID_SHIPMENT_TRANSITION",
      `Tracking event cannot transition Shipment from ${currentStatus} to ${nextStatus}.`,
    );
  }
}

export function assertFulfillmentEligibleForShipment(input: {
  fulfillmentExists: boolean;
  orderId: string;
  fulfillmentOrderId: string;
  status: "PENDING" | "SUBMITTED" | "FAILED" | "COMPLETED";
  provider: string;
  providerReference: string | null;
  destinationExists: boolean;
}): void {
  if (!input.fulfillmentExists) {
    throw new ShippingDomainError("FULFILLMENT_NOT_FOUND", "Fulfillment could not be found.");
  }
  if (input.orderId !== input.fulfillmentOrderId) {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "Fulfillment does not belong to the requested Order.",
    );
  }
  if (input.status !== "SUBMITTED" && input.status !== "COMPLETED") {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "Fulfillment is not eligible for Shipment creation.",
    );
  }
  if (!input.provider.trim() || !input.providerReference?.trim()) {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "Fulfillment does not contain the trusted provider reference required for Shipment handoff.",
    );
  }
  if (!input.destinationExists) {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "The historical Order shipping address is unavailable.",
    );
  }
}

export function assertOrderFulfillmentShipmentBoundary(input: {
  orderId: string;
  fulfillmentId: string;
  shipmentOrderId: string;
  shipmentFulfillmentId: string;
}): void {
  if (!input.orderId || !input.fulfillmentId) {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "Shipment creation requires canonical Order and Fulfillment identifiers.",
    );
  }
  if (input.orderId !== input.shipmentOrderId) {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "Shipment does not belong to the supplied Order.",
    );
  }
  if (input.fulfillmentId !== input.shipmentFulfillmentId) {
    throw new ShippingDomainError(
      "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
      "Shipment does not belong to the supplied Fulfillment.",
    );
  }
}
