import assert from "node:assert/strict";
import test from "node:test";
import { classifyShippingRetry, shippingRetryDelayMs } from "@/lib/shipping/retry";

test("ambiguous shipment creation is never automatically retryable", () => {
  assert.deepEqual(
    classifyShippingRetry({ classification: "AMBIGUOUS", operation: "SHIPMENT_CREATE" }),
    { retryable: false, classification: "AMBIGUOUS" },
  );
});

test("deterministic validation and provider business failures are not retryable", () => {
  for (const classification of ["VALIDATION", "AUTHENTICATION", "AUTHORIZATION", "PROVIDER_4XX"] as const) {
    assert.equal(
      classifyShippingRetry({ classification, operation: "RECONCILIATION" }).retryable,
      false,
    );
  }
});

test("transient tracking/reconciliation failures are retryable but shipment creation is bounded", () => {
  for (const classification of ["RATE_LIMIT", "PROVIDER_5XX", "NETWORK", "TIMEOUT"] as const) {
    assert.equal(
      classifyShippingRetry({ classification, operation: "TRACKING_LOOKUP" }).retryable,
      true,
    );
    assert.equal(
      classifyShippingRetry({ classification, operation: "SHIPMENT_CREATE" }).retryable,
      false,
    );
  }
});

test("retry delay is bounded and jittered deterministically for testing", () => {
  assert.equal(
    shippingRetryDelayMs(0, { random: () => 0.5 }),
    500,
  );
  assert.equal(
    shippingRetryDelayMs(10, { maxMs: 2000, random: () => 0.5 }),
    2000,
  );
});
