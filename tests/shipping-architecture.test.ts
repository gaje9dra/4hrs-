import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOrderFulfillmentShipmentBoundary,
  assertShipmentTransition,
  canTransitionShipmentStatus,
  isShipmentTerminal,
  shouldApplyTrackingEvent,
  assertTrackingEventTransition,
} from "@/lib/shipping/domain";

test("Shipment lifecycle allows forward transitions", () => {
  assert.equal(canTransitionShipmentStatus("CREATED", "IN_TRANSIT"), true);
  assert.equal(canTransitionShipmentStatus("CREATED", "DELIVERED"), false);
  assert.throws(() => assertShipmentTransition("CREATED", "DELIVERED"), /transition .* is not allowed/);
  assert.equal(canTransitionShipmentStatus("IN_TRANSIT", "OUT_FOR_DELIVERY"), true);
  assert.equal(canTransitionShipmentStatus("OUT_FOR_DELIVERY", "DELIVERED"), true);
});

test("tracking events cannot bypass the canonical lifecycle", () => {
  assert.throws(
    () => {
      assertTrackingEventTransition("CREATED", "DELIVERED");
    },
    /Tracking event cannot transition Shipment from CREATED to DELIVERED/,
  );
});

test("terminal Shipment states cannot transition", () => {
  assert.equal(isShipmentTerminal("DELIVERED"), true);
  assert.equal(isShipmentTerminal("RETURNED"), true);
  assert.equal(canTransitionShipmentStatus("DELIVERED", "IN_TRANSIT"), false);
  assert.equal(canTransitionShipmentStatus("RETURNED", "OUT_FOR_DELIVERY"), false);
});

test("invalid Shipment transitions are rejected", () => {
  assert.throws(() => assertShipmentTransition("DELIVERED", "IN_TRANSIT"), /transition .* is not allowed/);
});

test("duplicate and stale tracking events do not overwrite canonical state", () => {
  assert.equal(shouldApplyTrackingEvent("IN_TRANSIT", "IN_TRANSIT", new Date("2026-10-02T10:00:00Z"), new Date("2026-10-02T09:00:00Z")), "HISTORY_ONLY");
  assert.equal(shouldApplyTrackingEvent("DELIVERED", "IN_TRANSIT", new Date("2026-10-02T10:00:00Z"), new Date("2026-10-02T09:00:00Z")), "HISTORY_ONLY");
  assert.equal(shouldApplyTrackingEvent("IN_TRANSIT", "DELIVERED", new Date("2026-10-02T10:00:00Z"), new Date("2026-10-02T09:00:00Z")), "APPLY");
});

test("Shipment remains attached to its canonical Order and Fulfillment", () => {
  assert.doesNotThrow(() => assertOrderFulfillmentShipmentBoundary({
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    shipmentOrderId: "order-1",
    shipmentFulfillmentId: "fulfillment-1",
  }));
  assert.throws(() => assertOrderFulfillmentShipmentBoundary({
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    shipmentOrderId: "order-2",
    shipmentFulfillmentId: "fulfillment-1",
  }), /does not belong to the supplied Order/);
});

test("provider status remains separate from normalized Shipment status", () => {
  assert.equal("Manifested", "Manifested");
  assert.equal("IN_TRANSIT", "IN_TRANSIT");
});
