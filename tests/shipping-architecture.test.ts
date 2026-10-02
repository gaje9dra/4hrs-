import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionShipmentStatus } from "@/lib/shipping/domain";

test("Shipment lifecycle allows forward transitions", () => {
  assert.equal(canTransitionShipmentStatus("CREATED", "IN_TRANSIT"), true);
});
