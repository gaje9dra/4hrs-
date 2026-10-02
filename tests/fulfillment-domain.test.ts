import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createFulfillmentApplication, providerRequest } from "@/lib/fulfillment/application";
import { createFulfillmentProviderRegistry, createFulfillmentProviderResolver } from "@/lib/fulfillment/resolver";
import { FulfillmentDomainError } from "@/lib/fulfillment/errors";
import type { FulfillmentProviderAdapter } from "@/lib/fulfillment/provider";

const customers: string[] = [];
const payments: string[] = [];
const orders: string[] = [];
const fulfillments: string[] = [];
const products: string[] = [];

function mockAdapter(): FulfillmentProviderAdapter {
  return {
    id: "mock-provider",
    capabilities: { createFulfillment: true, statusLookup: true },
    validateConfiguration() {},
    async createFulfillment(request) { return { providerId: "mock-provider", providerFulfillmentReference: `mock-${request.fulfillmentId}`, status: "SUBMITTED" }; },
    async retrieveFulfillmentStatus() { throw new Error("external provider must not be invoked by this mock."); },
    normalizeStatus(input) {
      if (input === "PENDING" || input === "SUBMITTED" || input === "FAILED" || input === "COMPLETED") return input;
      throw new Error("unsupported mock status");
    },
    normalizeError() { return "PROVIDER_UNKNOWN_ERROR"; },
  };
}

function app() {
  const adapter = mockAdapter();
  return createFulfillmentApplication({
    providerResolver: createFulfillmentProviderResolver({
      registry: createFulfillmentProviderRegistry([adapter]),
      configuration: { id: adapter.id, enabled: true, mode: "test", secretReference: null, timeoutMs: 10000, capabilities: {} },
    }),
  });
}

async function fixture(status: "CONFIRMED" | "PENDING" = "CONFIRMED") {
  const customer = await db.customer.create({ data: { email: `${randomUUID()}@fulfillment-tests.invalid` } });
  customers.push(customer.id);
  const payment = await db.payment.create({
    data: {
      customerId: customer.id,
      checkoutReference: `checkout-${randomUUID()}`,
      internalReference: `pay-${randomUUID()}`,
      status: "SUCCEEDED",
      amount: new Prisma.Decimal("499.00"),
      currency: "INR",
      completedAt: new Date(),
    },
  });
  payments.push(payment.id);
  const product = await db.product.create({
    data: {
      title: "Snapshot Tee",
      slug: `snapshot-tee-${randomUUID()}`,
      status: "ACTIVE",
      price: new Prisma.Decimal("499.00"),
      currency: "INR",
    },
  });
  products.push(product.id);
  const variant = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: "TEE-M-" + randomUUID().slice(0, 8),
      displayName: "Black / M",
      size: "M",
      color: "Black",
      status: "ACTIVE",
    },
  });
  await db.fulfillmentProviderMapping.create({
    data: {
      variantId: variant.id,
      providerId: "mock-provider",
      providerSku: "MOCK-TEE-M-" + randomUUID().slice(0, 8),
      providerVariantReference: "mock-variant",
      active: true,
    },
  });
  const order = await db.order.create({
    data: {
      customerId: customer.id,
      checkoutReference: payment.checkoutReference,
      paymentId: payment.id,
      orderNumber: `ORD-${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`,
      status,
      subtotal: new Prisma.Decimal("499.00"),
      total: new Prisma.Decimal("499.00"),
      currency: "INR",
      items: { create: { productId: product.id, variantId: variant.id, productTitleSnapshot: "Snapshot Tee", variantTitleSnapshot: "Black / M", skuSnapshot: variant.sku, quantity: 2, unitPrice: new Prisma.Decimal("249.50"), lineTotal: new Prisma.Decimal("499.00"), currency: "INR" } },
      shippingAddress: { create: { recipientName: "Customer", phone: "9999999999", addressLine1: "1 Test Street", city: "Jaipur", stateOrProvince: "Rajasthan", postalCode: "302001", countryCode: "IN" } },
    },
    include: { items: true, shippingAddress: true },
  });
  orders.push(order.id);
  return { customer, payment, order };
}

async function expectCode(work: () => Promise<unknown>, code: FulfillmentDomainError["code"]) {
  await assert.rejects(work, (error: unknown) => error instanceof FulfillmentDomainError && error.code === code);
}

test("eligible confirmed Order creates one coherent Fulfillment from immutable snapshots", async () => {
  const f = await fixture();
  const result = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(result.id);
  assert.equal(result.orderId, f.order.id);
  assert.equal(result.provider, "mock-provider");
  assert.equal(result.status, "PENDING");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 2);
  assert.ok(result.items[0].providerSku?.startsWith("MOCK-TEE-M-"));
});

test("non-eligible Order is rejected and no Fulfillment is created", async () => {
  const f = await fixture("PENDING");
  await expectCode(() => app().createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` }), "FULFILLMENT_NOT_ELIGIBLE");
  assert.equal(await db.fulfillment.count({ where: { orderId: f.order.id } }), 0);
});

test("repeated idempotency key returns the original Fulfillment without duplication", async () => {
  const f = await fixture();
  const key = `fulfill-${randomUUID()}`;
  const first = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: key });
  fulfillments.push(first.id);
  const second = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: key });
  assert.equal(second.id, first.id);
  assert.equal(await db.fulfillment.count({ where: { orderId: f.order.id } }), 1);
});

test("concurrent creation cannot create duplicate Fulfillment records", async () => {
  const f = await fixture();
  const key = `fulfill-${randomUUID()}`;
  const results = await Promise.allSettled([
    app().createFulfillment({ orderId: f.order.id, idempotencyKey: key }),
    app().createFulfillment({ orderId: f.order.id, idempotencyKey: key }),
  ]);
  const successes = results.filter((r) => r.status === "fulfilled");
  const failures = results.filter((r) => r.status === "rejected");
  assert.ok(successes.length >= 1);
  assert.ok(successes.length <= 2);
  if (failures.length) {
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason instanceof FulfillmentDomainError);
    assert.ok(["FULFILLMENT_ALREADY_EXISTS", "FULFILLMENT_CONCURRENCY_CONFLICT"].includes(failures[0].reason.code));
  }
  const records = await db.fulfillment.findMany({ where: { orderId: f.order.id } });
  assert.equal(records.length, 1);
  assert.ok(successes.every((result) => result.status === "fulfilled" && result.value.id === records[0].id));
  fulfillments.push(records[0].id);
});

test("stale expected status is rejected and terminal state is protected", async () => {
  const f = await fixture();
  const created = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);
  const submitted = await app().transitionFulfillment({ fulfillmentId: created.id, expectedStatus: "PENDING", nextStatus: "SUBMITTED" });
  assert.equal(submitted.status, "SUBMITTED");
  await expectCode(
    () => app().transitionFulfillment({ fulfillmentId: created.id, expectedStatus: "PENDING", nextStatus: "COMPLETED" }),
    "FULFILLMENT_CONCURRENCY_CONFLICT",
  );
  const completed = await app().transitionFulfillment({ fulfillmentId: created.id, expectedStatus: "SUBMITTED", nextStatus: "COMPLETED" });
  assert.equal(completed.status, "COMPLETED");
  await expectCode(() => app().transitionFulfillment({ fulfillmentId: created.id, expectedStatus: "COMPLETED", nextStatus: "FAILED" }), "FULFILLMENT_INVALID_STATE");
  const terminal = await app().reconcileFulfillment({ fulfillmentId: created.id });
  assert.equal(terminal.status, "COMPLETED");
});

test("reconciliation never calls an unsupported provider status endpoint", async () => {
  const f = await fixture();
  const created = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);
  await expectCode(
    () => app().reconcileFulfillment({ fulfillmentId: created.id }),
    "FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED",
  );
});

test("unsupported provider configuration fails safely", async () => {
  const f = await fixture();
  const emptyResolver = createFulfillmentProviderResolver({ registry: createFulfillmentProviderRegistry([]), configuration: { id: "future-provider", enabled: true, mode: "test", secretReference: null, timeoutMs: 10000, capabilities: {} } });
  const service = createFulfillmentApplication({ providerResolver: emptyResolver });
  await expectCode(() => service.createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` }), "FULFILLMENT_PROVIDER_NOT_CONFIGURED");
});

test("provider request contains only fulfillment-required historical snapshot data", async () => {
  const f = await fixture();
  const orderWithMappings = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { items: { include: { variant: { include: { providerMappings: true } } } }, shippingAddress: true, payment: true, fulfillment: true, customer: true },
  });
  const request = providerRequest(orderWithMappings, f.order.id, "mock-provider");
  assert.equal(request.orderReference, f.order.id);
  assert.equal(request.orderNumber, f.order.orderNumber);
  assert.ok(request.items[0].sku.startsWith("MOCK-TEE-M-"));
  assert.equal(request.shippingAddress.recipientName, "Customer");
  assert.equal("customerId" in request, false);
  assert.equal("paymentId" in request, false);
  assert.equal("amount" in request, false);
});



test("provider submission happens outside the database transaction and persists the provider reference", async () => {
  const f = await fixture();
  const created = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);
  const submitted = await app().submitFulfillment({ fulfillmentId: created.id });
  assert.equal(submitted.status, "SUBMITTED");
  assert.equal(submitted.providerFulfillmentReference, `mock-${created.id}`);
  assert.ok(submitted.submittedAt);
  assert.ok(submitted.acceptedAt);
});

test("repeated provider submission does not call the adapter after successful persistence", async () => {
  const f = await fixture();
  let calls = 0;
  const adapter = mockAdapter();
  const countingAdapter: FulfillmentProviderAdapter = {
    ...adapter,
    async createFulfillment(request) {
      calls += 1;
      return adapter.createFulfillment(request);
    },
  };
  const service = createFulfillmentApplication({
    providerResolver: createFulfillmentProviderResolver({
      registry: createFulfillmentProviderRegistry([countingAdapter]),
      configuration: { id: countingAdapter.id, enabled: true, mode: "test", secretReference: null, timeoutMs: 10000, capabilities: {} },
    }),
  });
  const created = await service.createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);
  await service.submitFulfillment({ fulfillmentId: created.id });
  await service.submitFulfillment({ fulfillmentId: created.id });
  assert.equal(calls, 1);
});

test("same provider operation idempotency key does not execute a second provider call", async () => {
  const f = await fixture();
  let calls = 0;
  const adapter = mockAdapter();
  const countingAdapter: FulfillmentProviderAdapter = {
    ...adapter,
    async createFulfillment(request) { calls += 1; return adapter.createFulfillment(request); },
  };
  const service = createFulfillmentApplication({
    providerResolver: createFulfillmentProviderResolver({
      registry: createFulfillmentProviderRegistry([countingAdapter]),
      configuration: { id: countingAdapter.id, enabled: true, mode: "test", secretReference: null, timeoutMs: 10000, capabilities: {} },
    }),
  });
  const created = await service.createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);
  const key = `submit-${randomUUID()}`;
  await service.submitFulfillment({ fulfillmentId: created.id, idempotencyKey: key });
  await service.submitFulfillment({ fulfillmentId: created.id, idempotencyKey: key });
  assert.equal(calls, 1);
  assert.equal(await db.fulfillmentOperationIdempotency.count({ where: { fulfillmentId: created.id, idempotencyKey: key, status: "SUCCEEDED" } }), 1);
});

test("provider retries are bounded and non-retryable failures cannot loop", async () => {
  const f = await fixture();
  let calls = 0;
  const adapter = mockAdapter();
  const rateLimitedAdapter: FulfillmentProviderAdapter = {
    ...adapter,
    async createFulfillment() {
      calls += 1;
      throw Object.assign(new Error("rate limited"), { category: "PROVIDER_RATE_LIMITED" });
    },
    normalizeError(error) {
      return typeof error === "object" && error !== null && "category" in error
        ? (error as { category: "PROVIDER_RATE_LIMITED" }).category
        : "PROVIDER_UNKNOWN_ERROR";
    },
  };
  const service = createFulfillmentApplication({
    providerResolver: createFulfillmentProviderResolver({
      registry: createFulfillmentProviderRegistry([rateLimitedAdapter]),
      configuration: { id: rateLimitedAdapter.id, enabled: true, mode: "test", secretReference: null, timeoutMs: 10000, capabilities: {} },
    }),
  });
  const created = await service.createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expectCode(
      () => service.submitFulfillment({ fulfillmentId: created.id }),
      "FULFILLMENT_PROVIDER_SUBMISSION_FAILED",
    );
  }
  await expectCode(
    () => service.submitFulfillment({ fulfillmentId: created.id }),
    "FULFILLMENT_PROVIDER_RETRY_NOT_ALLOWED",
  );
  assert.equal(calls, 3);

  const stored = await db.fulfillment.findUniqueOrThrow({ where: { id: created.id } });
  assert.deepEqual(stored.reconciliationMetadata, {
    ambiguous: false,
    retryable: true,
    reconciliationRequired: false,
    submissionAttempts: 3,
    provider: "mock-provider",
  });
});

test("non-retryable provider failures are blocked after the first attempt", async () => {
  const f = await fixture();
  let calls = 0;
  const adapter = mockAdapter();
  const rejectingAdapter: FulfillmentProviderAdapter = {
    ...adapter,
    async createFulfillment() {
      calls += 1;
      throw Object.assign(new Error("invalid"), { category: "PROVIDER_VALIDATION" });
    },
    normalizeError(error) {
      return typeof error === "object" && error !== null && "category" in error
        ? (error as { category: "PROVIDER_VALIDATION" }).category
        : "PROVIDER_UNKNOWN_ERROR";
    },
  };
  const service = createFulfillmentApplication({
    providerResolver: createFulfillmentProviderResolver({
      registry: createFulfillmentProviderRegistry([rejectingAdapter]),
      configuration: { id: rejectingAdapter.id, enabled: true, mode: "test", secretReference: null, timeoutMs: 10000, capabilities: {} },
    }),
  });
  const created = await service.createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);

  await expectCode(
    () => service.submitFulfillment({ fulfillmentId: created.id }),
    "FULFILLMENT_PROVIDER_SUBMISSION_FAILED",
  );
  await expectCode(
    () => service.submitFulfillment({ fulfillmentId: created.id }),
    "FULFILLMENT_PROVIDER_RETRY_NOT_ALLOWED",
  );
  assert.equal(calls, 1);
});

test("Fulfillment cannot alter historical Order snapshots", async () => {
  const f = await fixture();
  const before = await db.order.findUniqueOrThrow({ where: { id: f.order.id }, include: { items: true, shippingAddress: true } });
  const created = await app().createFulfillment({ orderId: f.order.id, idempotencyKey: `fulfill-${randomUUID()}` });
  fulfillments.push(created.id);
  const afterOrder = await db.order.findUniqueOrThrow({ where: { id: f.order.id }, include: { items: true, shippingAddress: true } });
  assert.equal(afterOrder.total.toFixed(2), before.total.toFixed(2));
  assert.equal(afterOrder.items[0].productTitleSnapshot, before.items[0].productTitleSnapshot);
  assert.equal(afterOrder.items[0].skuSnapshot, before.items[0].skuSnapshot);
  assert.equal(afterOrder.shippingAddress?.addressLine1, before.shippingAddress?.addressLine1);
});

after(async () => {
  if (orders.length) await db.fulfillment.deleteMany({ where: { orderId: { in: orders } } });
  if (orders.length) await db.order.deleteMany({ where: { id: { in: orders } } });
  if (payments.length) await db.payment.deleteMany({ where: { id: { in: payments } } });
  if (products.length) await db.product.deleteMany({ where: { id: { in: products } } });
  if (customers.length) await db.customer.deleteMany({ where: { id: { in: customers } } });
  await db.$disconnect();
});
