import assert from "node:assert/strict";
import test from "node:test";
import { qikinkShippingProvider } from "@/lib/shipping/providers/qikink";
import { createShippingProviderResolver } from "@/lib/shipping/resolver";

test("Qikink Shipping capabilities remain disabled without a verified provider contract", () => {
  assert.deepEqual(qikinkShippingProvider.capabilities, {
    createShipment: false,
    trackingLookup: false,
    webhooks: false,
  });
});

test("Shipping resolver can resolve Qikink only as an explicitly unsupported Shipping adapter", () => {
  const resolver = createShippingProviderResolver();
  const provider = resolver.resolve("QIKINK");

  assert.equal(provider?.id, "qikink");
  assert.equal(provider?.capabilities.createShipment, false);
  assert.equal(provider?.capabilities.trackingLookup, false);
  assert.equal(provider?.capabilities.webhooks, false);
});

test("Qikink Shipping adapter does not fabricate tracking data", () => {
  assert.throws(
    () => qikinkShippingProvider.normalizeTrackingEvent({
      order_id: "2234",
      status: "Delivered",
      awb: "not-verified",
    }),
    /verified provider event contract exists/,
  );
});
