import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYTICS_EVENT_CATALOG,
  ANALYTICS_MAX_PAYLOAD_BYTES,
  validateAnalyticsEvent,
  AnalyticsError,
} from "@/lib/analytics/events";

const base = {
  eventId: "evt_123",
  eventName: "PRODUCT_VIEWED",
  eventVersion: 1,
  occurredAt: new Date().toISOString(),
  properties: { productId: "product_1" },
  source: "CLIENT" as const,
};

test("analytics catalog exposes only versioned supported events", () => {
  assert.equal(ANALYTICS_EVENT_CATALOG.PRODUCT_VIEWED.version, 1);
  assert.ok("ADD_TO_CART" in ANALYTICS_EVENT_CATALOG);
  assert.ok(!("PURCHASE_COMPLETED" in ANALYTICS_EVENT_CATALOG));
});

test("analytics event validation accepts governed properties", () => {
  const result = validateAnalyticsEvent(base);
  assert.equal(result.eventName, "PRODUCT_VIEWED");
  assert.equal(result.properties.productId, "product_1");
});

test("analytics rejects unknown event names and versions", () => {
  assert.throws(
    () => validateAnalyticsEvent({ ...base, eventName: "PURCHASE_COMPLETED" }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_EVENT",
  );
  assert.throws(
    () => validateAnalyticsEvent({ ...base, eventVersion: 2 }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_VERSION",
  );
});

test("analytics rejects forbidden PII-like properties", () => {
  assert.throws(
    () => validateAnalyticsEvent({ ...base, properties: { productId: "p1", email: "user@example.com" } }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_PROPERTIES",
  );
});

test("analytics rejects unsupported property injection", () => {
  assert.throws(
    () => validateAnalyticsEvent({ ...base, properties: { productId: "p1", adminRole: "SUPERADMIN" } }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_PROPERTIES",
  );
});

test("analytics rejects oversized payloads", () => {
  const oversized = "x".repeat(ANALYTICS_MAX_PAYLOAD_BYTES + 1);
  assert.throws(
    () => validateAnalyticsEvent({ ...base, properties: { page: oversized } }),
    (error: unknown) => error instanceof AnalyticsError,
  );
});

test("analytics rejects stale and future timestamps", () => {
  assert.throws(
    () => validateAnalyticsEvent({ ...base, occurredAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_TIMESTAMP",
  );
  assert.throws(
    () => validateAnalyticsEvent({ ...base, occurredAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_TIMESTAMP",
  );
});

test("analytics event IDs reject customer-derived or malformed identifiers", () => {
  assert.throws(
    () => validateAnalyticsEvent({ ...base, eventId: "john@example.com" }),
    (error: unknown) => error instanceof AnalyticsError && error.code === "INVALID_EVENT",
  );
});
