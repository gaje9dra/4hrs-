import assert from "node:assert/strict";
import test from "node:test";
import { createQikinkFulfillmentProvider, providerOrderNumber } from "@/lib/fulfillment/providers/qikink";
import { assertPrivateFulfillmentConfiguration } from "@/lib/fulfillment/config";
import { clearQikinkAccessTokenCache } from "@/lib/fulfillment/providers/qikink-auth";

function request() {
  return {
    fulfillmentId: "11111111-2222-4333-8444-555555555555",
    orderReference: "11111111-2222-4333-8444-555555555555",
    orderNumber: "ORD-ABCDEF1234567890",
    currency: "INR",
    orderTotal: "999.00",
    items: [
      {
        orderItemId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        sku: "USs-Wh-M",
        variantId: null,
        quantity: 2,
        unitPrice: "499.50",
      },
    ],
    shippingAddress: {
      recipientName: "Gajendra Singh",
      phone: "9876543210",
      email: "customer@example.test",
      addressLine1: "1 Test Street",
      addressLine2: "Near Market",
      city: "Jaipur",
      stateOrProvince: "Rajasthan",
      postalCode: "302001",
      countryCode: "IN",
    },
  };
}

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("Fulfillment credentials cannot be configured through NEXT_PUBLIC variables", () => {
  assert.throws(
    () => assertPrivateFulfillmentConfiguration({
      id: "qikink",
      enabled: true,
      mode: "live",
      secretReference: "NEXT_PUBLIC_QIKINK_AUTH_TOKEN",
      timeoutMs: 10000,
      capabilities: {},
    }),
    /NEXT_PUBLIC_/,
  );
});

test("Qikink provider creates a fulfillment from canonical data", async () => {
  let captured!: { url: string; init: RequestInit };
  const provider = createQikinkFulfillmentProvider({
    authToken: "secret-token",
    timeoutMs: 5000,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init: init ?? {} };
      return response({ code: 1, order_id: 2234, msg: "Successfully created order" });
    },
  });

  const result = await provider.createFulfillment(request());

  assert.equal(result.providerId, "qikink");
  assert.equal(result.providerFulfillmentReference, "2234");
  assert.equal(result.status, "SUBMITTED");
  assert.ok(captured);
  assert.equal(captured.url, "https://qikink.com/erp2/index.php/api/createOrder");
  const body = JSON.parse(String(captured.init.body));
  assert.equal(body.auth_token, "secret-token");
  assert.equal(body.order_number, providerOrderNumber(request().fulfillmentId));
  assert.equal(body.order_number.length, 15);
  assert.match(body.order_number, /^[A-Z0-9]+$/);
  assert.equal(body.qikink_shipping, 1);
  assert.equal(body.gateway, "online");
  assert.equal(body.total_order_value, "999.00");
  assert.equal(body.line_items[0].sku, "USs-Wh-M");
  assert.equal(body.line_items[0].quantity, "2");
  assert.equal(body.line_items[0].price, "499.50");
  assert.equal(body.shipping_address.email, "customer@example.test");
  assert.equal(body.shipping_address.country_code, "IN");
  assert.equal(body.auth_token, "secret-token");
});

test("Qikink provider rejects missing credentials before network access", async () => {
  let calls = 0;
  const provider = createQikinkFulfillmentProvider({
    authToken: "",
    fetchImpl: async () => {
      calls += 1;
      return response({});
    },
  });
  assert.throws(() => provider.validateConfiguration(), /QIKINK_AUTH_TOKEN/);
  assert.equal(calls, 0);
});

test("Qikink provider maps documented processing statuses without inventing terminal states", () => {
  const provider = createQikinkFulfillmentProvider({ authToken: "token" });
  assert.equal(provider.normalizeStatus("Live"), "SUBMITTED");
  assert.equal(provider.normalizeStatus("Printed"), "SUBMITTED");
  assert.equal(provider.normalizeStatus("Delivered"), "COMPLETED");
  assert.equal(provider.normalizeStatus("RTO Initiated"), "FAILED");
  assert.equal(provider.normalizeStatus("Returned"), "FAILED");
  assert.equal(provider.normalizeStatus("Cancelled"), "FAILED");
  assert.equal(provider.normalizeStatus("unknown-provider-status"), "PENDING");
});

test("Qikink provider normalizes validation and authentication failures", async () => {
  const provider = createQikinkFulfillmentProvider({
    authToken: "token",
    fetchImpl: async () => response({ code: 0, msg: "Invalid SKU" }),
  });
  await assert.rejects(
    () => provider.createFulfillment(request()),
    (error: unknown) => provider.normalizeError(error) === "PROVIDER_REJECTED",
  );

  const unauthorized = createQikinkFulfillmentProvider({
    authToken: "token",
    fetchImpl: async () => response({ message: "unauthorized" }, { status: 401 }),
  });
  await assert.rejects(
    () => unauthorized.createFulfillment(request()),
    (error: unknown) => provider.normalizeError(error) === "PROVIDER_AUTHENTICATION",
  );
});

test("Qikink timeout is bounded and classified as ambiguous", async () => {
  const provider = createQikinkFulfillmentProvider({
    authToken: "token",
    timeoutMs: 1000,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });
  await assert.rejects(
    () => provider.createFulfillment(request()),
    (error: unknown) => provider.normalizeError(error) === "PROVIDER_TIMEOUT",
  );
});

test("Qikink status lookup remains disabled until a verified status contract is available", async () => {
  const provider = createQikinkFulfillmentProvider({ authToken: "token" });
  await assert.rejects(() => provider.retrieveFulfillmentStatus({
    providerFulfillmentReference: "2234",
    orderReference: request().orderReference,
  }));
  assert.equal(provider.capabilities.statusLookup, false);
});


test("Qikink Open API provider exchanges Client credentials and creates a Live order", async () => {
  const original = {
    clientId: process.env.QIKINK_CLIENT_ID,
    clientSecret: process.env.QIKINK_CLIENT_SECRET,
    sandboxSecret: process.env.QIKINK_SANDBOX_SECRET,
    mode: process.env.FULFILLMENT_PROVIDER_MODE,
  };

  process.env.QIKINK_CLIENT_ID = "live-client";
  process.env.QIKINK_CLIENT_SECRET = "live-secret";
  delete process.env.QIKINK_SANDBOX_SECRET;
  process.env.FULFILLMENT_PROVIDER_MODE = "live";
  clearQikinkAccessTokenCache();

  try {
    let calls = 0;
    const provider = createQikinkFulfillmentProvider({
      timeoutMs: 5000,
      fetchImpl: async (url, init) => {
        calls += 1;
        if (String(url) === "https://api.qikink.com/api/token") {
          return response({ Accesstoken: "access-token", expires_in: 3600 });
        }

        assert.equal(String(url), "https://api.qikink.com/api/order/create");
        assert.equal(new Headers(init?.headers).get("ClientId"), "live-client");
        assert.equal(new Headers(init?.headers).get("Accesstoken"), "access-token");

        const body = JSON.parse(String(init?.body));
        assert.equal(body.order_number, providerOrderNumber(request().fulfillmentId));
        assert.equal(body.qikink_shipping, "1");
        assert.equal(body.gateway, "Prepaid");
        assert.equal(body.line_items[0].search_from_my_products, 1);
        return response({ status_code: "200", order_id: 7451136, message: "Order created successfully" });
      },
    });

    const result = await provider.createFulfillment(request());
    assert.equal(result.providerFulfillmentReference, "7451136");
    assert.equal(result.status, "SUBMITTED");
    assert.equal(calls, 2);
  } finally {
    if (original.clientId === undefined) delete process.env.QIKINK_CLIENT_ID;
    else process.env.QIKINK_CLIENT_ID = original.clientId;
    if (original.clientSecret === undefined) delete process.env.QIKINK_CLIENT_SECRET;
    else process.env.QIKINK_CLIENT_SECRET = original.clientSecret;
    if (original.sandboxSecret === undefined) delete process.env.QIKINK_SANDBOX_SECRET;
    else process.env.QIKINK_SANDBOX_SECRET = original.sandboxSecret;
    if (original.mode === undefined) delete process.env.FULFILLMENT_PROVIDER_MODE;
    else process.env.FULFILLMENT_PROVIDER_MODE = original.mode;
    clearQikinkAccessTokenCache();
  }
});
