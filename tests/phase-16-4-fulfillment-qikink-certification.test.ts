import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { assertFulfillmentTransition, assertOrderFulfillmentEligibility } from "@/lib/fulfillment/domain";
import { createQikinkFulfillmentProvider, providerOrderNumber } from "@/lib/fulfillment/providers/qikink";

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

function request() {
  return {
    fulfillmentId: "11111111-1111-1111-1111-111111111111",
    orderReference: "order-1",
    orderNumber: "4HRS-1001",
    currency: "INR",
    orderTotal: "1998.00",
    items: [{
      orderItemId: "item-1",
      sku: "QIKINK-SKU-001",
      variantId: "variant-1",
      quantity: 2,
      unitPrice: "999.00",
    }],
    shippingAddress: {
      recipientName: "Test Customer",
      phone: "9999999999",
      email: "test@example.com",
      addressLine1: "1 Test Street",
      addressLine2: null,
      city: "Jaipur",
      stateOrProvince: "Rajasthan",
      postalCode: "302001",
      countryCode: "IN",
    },
  } as const;
}

test("fulfillment eligibility rejects unpaid/non-confirmed orders", () => {
  assert.throws(
    () => assertOrderFulfillmentEligibility({
      status: "PENDING",
      paymentStatus: "SUCCEEDED",
      paymentCompletedAt: new Date(),
      items: [{ id: "i", quantity: 1, skuSnapshot: "SKU", variantId: "v" }],
      shippingAddress: {
        recipientName: "Test",
        addressLine1: "Address",
        city: "Jaipur",
        stateOrProvince: "Rajasthan",
        postalCode: "302001",
        countryCode: "IN",
      },
    }),
    /fulfillment-eligible/,
  );
  assert.throws(
    () => assertOrderFulfillmentEligibility({
      status: "CONFIRMED",
      paymentStatus: "FAILED",
      paymentCompletedAt: null,
      items: [{ id: "i", quantity: 1, skuSnapshot: "SKU", variantId: "v" }],
      shippingAddress: {
        recipientName: "Test",
        addressLine1: "Address",
        city: "Jaipur",
        stateOrProvince: "Rajasthan",
        postalCode: "302001",
        countryCode: "IN",
      },
    }),
    /payment is not authoritative/,
  );
});

test("fulfillment state machine protects terminal and illegal transitions", () => {
  assert.doesNotThrow(() => assertFulfillmentTransition("PENDING", "SUBMITTED"));
  assert.doesNotThrow(() => assertFulfillmentTransition("SUBMITTED", "COMPLETED"));
  assert.throws(() => assertFulfillmentTransition("COMPLETED", "FAILED"), /terminal/);
  assert.throws(() => assertFulfillmentTransition("PENDING", "COMPLETED"), /not allowed/);
});

test("Qikink adapter isolates provider credentials and returns only normalized response", async () => {
  const oldToken = process.env.QIKINK_AUTH_TOKEN;
  const oldClientId = process.env.QIKINK_CLIENT_ID;
  const oldClientSecret = process.env.QIKINK_CLIENT_SECRET;
  const oldMode = process.env.FULFILLMENT_PROVIDER_MODE;
  process.env.QIKINK_AUTH_TOKEN = "test-secret-provider-token";
  delete process.env.QIKINK_CLIENT_ID;
  delete process.env.QIKINK_CLIENT_SECRET;
  process.env.FULFILLMENT_PROVIDER_MODE = "test";

  let captured = "";
  const adapter = createQikinkFulfillmentProvider({
    timeoutMs: 2000,
    fetchImpl: async (_url, init) => {
      captured = String(init?.body ?? "");
      return new Response(JSON.stringify({ code: 1, order_id: "QK-12345" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await adapter.createFulfillment(request());
  assert.equal(result.providerId, "qikink");
  assert.equal(result.providerFulfillmentReference, "QK-12345");
  assert.equal(result.status, "SUBMITTED");
  assert.match(captured, /test-secret-provider-token/);
  assert.equal(JSON.stringify(result).includes("test-secret-provider-token"), false);
  assert.match(providerOrderNumber(request().fulfillmentId), /^4H[A-Z0-9]{13}$/);

  if (oldToken === undefined) delete process.env.QIKINK_AUTH_TOKEN; else process.env.QIKINK_AUTH_TOKEN = oldToken;
  if (oldClientId === undefined) delete process.env.QIKINK_CLIENT_ID; else process.env.QIKINK_CLIENT_ID = oldClientId;
  if (oldClientSecret === undefined) delete process.env.QIKINK_CLIENT_SECRET; else process.env.QIKINK_CLIENT_SECRET = oldClientSecret;
  if (oldMode === undefined) delete process.env.FULFILLMENT_PROVIDER_MODE; else process.env.FULFILLMENT_PROVIDER_MODE = oldMode;
});

test("Qikink adapter classifies malformed and timeout provider failures", async () => {
  const oldToken = process.env.QIKINK_AUTH_TOKEN;
  const oldClientId = process.env.QIKINK_CLIENT_ID;
  const oldClientSecret = process.env.QIKINK_CLIENT_SECRET;
  delete process.env.QIKINK_CLIENT_ID;
  delete process.env.QIKINK_CLIENT_SECRET;
  process.env.QIKINK_AUTH_TOKEN = "test-secret-provider-token";

  const malformed = createQikinkFulfillmentProvider({
    fetchImpl: async () => new Response("not-json", { status: 200 }),
  });
  await assert.rejects(() => malformed.createFulfillment(request()), (error: unknown) => {
    return typeof error === "object" && error !== null && "category" in error && (error as { category: string }).category === "PROVIDER_INVALID_RESPONSE";
  });

  const timeout = createQikinkFulfillmentProvider({
    fetchImpl: async () => { throw new DOMException("timed out", "AbortError"); },
  });
  await assert.rejects(() => timeout.createFulfillment(request()), (error: unknown) => {
    return typeof error === "object" && error !== null && "category" in error && (error as { category: string }).category === "PROVIDER_TIMEOUT";
  });

  if (oldToken === undefined) delete process.env.QIKINK_AUTH_TOKEN; else process.env.QIKINK_AUTH_TOKEN = oldToken;
  if (oldClientId === undefined) delete process.env.QIKINK_CLIENT_ID; else process.env.QIKINK_CLIENT_ID = oldClientId;
  if (oldClientSecret === undefined) delete process.env.QIKINK_CLIENT_SECRET; else process.env.QIKINK_CLIENT_SECRET = oldClientSecret;
});

test("Qikink status lookup is explicitly unsupported rather than fabricated", async () => {
  const oldToken = process.env.QIKINK_AUTH_TOKEN;
  process.env.QIKINK_AUTH_TOKEN = "test-secret-provider-token";
  const adapter = createQikinkFulfillmentProvider({ fetchImpl: async () => new Response("{}") });
  assert.equal(adapter.capabilities.statusLookup, false);
  await assert.rejects(() => adapter.retrieveFulfillmentStatus({
    providerFulfillmentReference: "QK-12345",
    orderReference: "order-1",
  }), /verified status endpoint/);
  if (oldToken === undefined) delete process.env.QIKINK_AUTH_TOKEN; else process.env.QIKINK_AUTH_TOKEN = oldToken;
});

test("fulfillment certification source evidence protects mapping, idempotency, retries and concurrency", () => {
  const schema = read("prisma/schema.prisma");
  const application = read("lib/fulfillment/application.ts");
  const repository = read("lib/fulfillment/repository.ts");
  const domain = read("lib/fulfillment/domain.ts");

  assert.match(schema, /model FulfillmentProviderMapping/);
  assert.match(schema, /@@unique\(\[variantId, providerId\]\)/);
  assert.match(schema, /@@unique\(\[providerId, providerSku\]\)/);
  assert.match(schema, /idempotencyKey\s+String[^\n]*@unique/);
  assert.match(schema, /orderId\s+String[^\n]*@unique/);
  assert.match(application, /Serializable/);
  assert.match(application, /getByIdempotencyKey/);
  assert.match(application, /getByOrderId/);
  assert.match(application, /attempt < 3/);
  assert.match(application, /FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED/);
  assert.match(repository, /expectedStatus/);
  assert.match(domain, /status !== "CONFIRMED"/);
  assert.match(domain, /paymentStatus !== "SUCCEEDED"/);
});

test("fulfillment certification source evidence protects secret and shipping boundaries", () => {
  const qikink = read("lib/fulfillment/providers/qikink.ts");
  const auth = read("lib/fulfillment/providers/qikink-auth.ts");
  const shipping = read("lib/shipping/providers/qikink.ts");
  const appRoutes = read("app/api/admin/fulfillment/route.ts") + read("app/api/admin/fulfillments/route.ts");

  assert.equal(/NEXT_PUBLIC_.*QIKINK/i.test(qikink + auth), false);
  assert.match(auth, /process\.env\.QIKINK_CLIENT_SECRET/);
  assert.match(shipping, /createShipment: false/);
  assert.match(shipping, /trackingLookup: false/);
  assert.match(shipping, /webhooks: false/);
  if (appRoutes.trim()) assert.match(appRoutes, /requireAdmin/);
});
