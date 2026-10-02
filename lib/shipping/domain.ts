import { ShipmentStatus } from "@prisma/client";
import { SHIPPING_STATUSES } from "@/lib/shipping/contracts";

const TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  CREATED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "RETURNED"],
  DELIVERED: [],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNED"],
  RETURNED: [],
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
  if (current === next) throw new Error("Shipment state must change.");
  if (!canTransitionShipmentStatus(current, next)) {
    throw new Error(`Invalid Shipment transition: ${current} -> ${next}.`);
  }
}

export function shouldApplyTrackingEvent(currentStatus: ShipmentStatus, eventStatus: ShipmentStatus): boolean {
  if (currentStatus === eventStatus) return false;
  if (isShipmentTerminal(currentStatus)) return false;
  return canTransitionShipmentStatus(currentStatus, eventStatus);
}

export function assertOrderFulfillmentShipmentBoundary(input: {
  orderId: string;
  fulfillmentId: string;
  shipmentOrderId: string;
  shipmentFulfillmentId: string;
}): void {
  if (!input.orderId || !input.fulfillmentId) {
    throw new Error("Shipment creation requires canonical Order and Fulfillment identifiers.");
  }
  if (input.orderId !== input.shipmentOrderId) {
    throw new Error("Shipment does not belong to the supplied Order.");
  }
  if (input.fulfillmentId !== input.shipmentFulfillmentId) {
    throw new Error("Shipment does not belong to the supplied Fulfillment.");
  }
}
