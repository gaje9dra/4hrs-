import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiContractError,
  API_CLASSIFICATIONS,
  apiResponse,
  noStoreClassification,
  parseIdempotencyKey,
  parsePositivePagination,
} from "@/lib/api/governance";

test("defines all canonical API audiences", () => {
  assert.equal(API_CLASSIFICATIONS.PUBLIC_STOREFRONT.cache, "public");
  assert.equal(API_CLASSIFICATIONS.AUTHENTICATED_CUSTOMER.browserAccessible, true);
  assert.equal(API_CLASSIFICATIONS.ADMIN.cache, "private");
  assert.equal(API_CLASSIFICATIONS.WEBHOOK.browserAccessible, false);
  assert.equal(API_CLASSIFICATIONS.BACKGROUND_JOB.cache, "no-store");
});

test("emits request IDs and private cache semantics", () => {
  const request = new Request("https://example.test/api/customer/profile", {
    headers: { "x-request-id": "phase15.15-test" },
  });
  const response = apiResponse({ ok: true }, request, {}, noStoreClassification());
  assert.equal(response.headers.get("x-request-id"), "phase15.15-test");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("rejects malformed idempotency keys", () => {
  const request = new Request("https://example.test/api/payment", {
    headers: { "Idempotency-Key": "short" },
  });
  assert.throws(
    () => parseIdempotencyKey(request),
    (error: unknown) => error instanceof ApiContractError && error.code === "INVALID_IDEMPOTENCY_KEY",
  );
});

test("accepts bounded idempotency keys", () => {
  const request = new Request("https://example.test/api/payment", {
    headers: { "Idempotency-Key": "customer-payment-20261003-01" },
  });
  assert.equal(parseIdempotencyKey(request), "customer-payment-20261003-01");
});

test("rejects unsupported and unbounded pagination", () => {
  const unsupported = new Request("https://example.test/api/orders?page=1&sort=total");
  assert.throws(() => parsePositivePagination(unsupported), /unsupported parameter/i);

  const oversized = new Request("https://example.test/api/orders?pageSize=101");
  assert.throws(() => parsePositivePagination(oversized), /pagination parameters are invalid/i);
});

test("accepts explicit bounded pagination", () => {
  const request = new Request("https://example.test/api/orders?page=2&pageSize=50");
  assert.deepEqual(parsePositivePagination(request), { page: 2, pageSize: 50 });
});
