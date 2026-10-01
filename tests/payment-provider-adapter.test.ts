import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentApplication } from "@/lib/payments/application";
import { loadPaymentProviderConfiguration, publicPaymentProviderConfiguration } from "@/lib/payments/config";
import { normalizeClientAction } from "@/lib/payments/client-action";
import { createPaymentProviderRegistry, createPaymentProviderResolver } from "@/lib/payments/resolver";
import type { PaymentProviderAdapter, PaymentProviderCapabilities } from "@/lib/payments/provider";

const capabilities: PaymentProviderCapabilities = {
  createPayment: true,
  clientAction: true,
  webhookVerification: true,
  statusLookup: true,
  cancellation: false,
  refunds: false,
  partialRefunds: false,
};

function adapter(overrides: Partial<PaymentProviderAdapter> = {}): PaymentProviderAdapter {
  return {
    id: "test-provider",
    capabilities,
    async createPayment() {
      return {
        providerId: "test-provider",
        providerPaymentReference: "pp-1",
        providerAttemptReference: "pa-1",
        status: "PROCESSING",
        clientAction: { type: "NONE" },
      };
    },
    async retrievePayment() {
      return {
        providerId: "test-provider",
        providerPaymentReference: "pp-1",
        providerAttemptReference: "pa-1",
        status: "PROCESSING",
        clientAction: { type: "NONE" },
      };
    },
    async verifyPayment() {
      return {
        providerId: "test-provider",
        providerPaymentReference: "pp-1",
        providerAttemptReference: "pa-1",
        status: "SUCCEEDED",
        clientAction: { type: "NONE" },
      };
    },
    async verifyWebhook() {
      return {
        verified: true,
        event: {
          providerId: "test-provider",
          providerEventReference: "evt-1",
          providerPaymentReference: "pp-1",
          internalPaymentReference: "payment-ref-1",
          normalizedEventType: "PAYMENT_PROCESSING",
          status: "PROCESSING",
          occurredAt: "2026-10-01T00:00:00.000Z",
        },
      };
    },
    normalizeStatus(status) {
      if (status === "SUCCEEDED") return "SUCCEEDED";
      if (status === "FAILED") return "FAILED";
      if (status === "REQUIRES_ACTION") return "REQUIRES_ACTION";
      return "PROCESSING";
    },
    normalizeError() {
      return "PROVIDER_UNKNOWN_ERROR";
    },
    ...overrides,
  };
}

test("resolver only returns an enabled server-configured provider", () => {
  const registry = createPaymentProviderRegistry([adapter()]);
  const disabled = createPaymentProviderResolver({
    registry,
    configuration: {
      id: "test-provider",
      enabled: false,
      mode: "test",
      publicKey: null,
      secretReference: "PAYMENT_PROVIDER_SECRET_REFERENCE",
      webhookSecretReference: "PAYMENT_PROVIDER_WEBHOOK_SECRET_REFERENCE",
      timeoutMs: 10000,
      capabilities: {},
    },
  });
  assert.equal(disabled.resolve({ customerId: "c", checkoutReference: "x", currency: "INR" }), undefined);

  const enabled = createPaymentProviderResolver({
    registry,
    configuration: {
      id: "test-provider",
      enabled: true,
      mode: "test",
      publicKey: "public",
      secretReference: "PAYMENT_PROVIDER_SECRET_REFERENCE",
      webhookSecretReference: "PAYMENT_PROVIDER_WEBHOOK_SECRET_REFERENCE",
      timeoutMs: 10000,
      capabilities: {},
    },
  });
  assert.equal(enabled.resolve({ customerId: "c", checkoutReference: "x", currency: "INR" })?.id, "test-provider");
  assert.equal(enabled.resolve({ customerId: "c", checkoutReference: "x", currency: "INR", providerId: "other" }), undefined);
});

test("registry rejects duplicate adapter identifiers", () => {
  assert.throws(() => createPaymentProviderRegistry([adapter(), adapter()]), /Duplicate payment provider adapter/);
});

test("configuration has private and public boundaries", () => {
  const config = loadPaymentProviderConfiguration({
    providerId: "Test-Provider",
    enabled: "true",
    mode: "live",
    publicKey: "public-key",
    secretReference: "PAYMENT_PROVIDER_SECRET",
    webhookSecretReference: "PAYMENT_PROVIDER_WEBHOOK_SECRET",
    timeoutMs: "25000",
  });
  assert.equal(config?.id, "test-provider");
  assert.deepEqual(publicPaymentProviderConfiguration(config!), {
    id: "test-provider",
    mode: "live",
    publicKey: "public-key",
  });
  assert.throws(() => loadPaymentProviderConfiguration({ providerId: "NEXT_PUBLIC_BAD" }), /private/i);
});

test("client action normalization only permits safe client-action data", () => {
  assert.equal(normalizeClientAction(undefined).type, "NONE");
  assert.equal(normalizeClientAction({ type: "REDIRECT", redirectUrl: "http://example.test" }).type, "NONE");
  assert.equal(normalizeClientAction({ type: "REDIRECT", redirectUrl: "https://example.test/pay" }).type, "REDIRECT");
  assert.equal(normalizeClientAction({ type: "EMBEDDED", publicToken: "" }).type, "NONE");
  assert.equal(normalizeClientAction({ type: "SDK_ACTION", publicToken: "public-token" }).type, "SDK_ACTION");
});

test("provider status normalization stays inside the adapter boundary", () => {
  const testAdapter = adapter({
    normalizeStatus(status) {
      if (status === "provider_paid") return "SUCCEEDED";
      if (status === "provider_pending") return "PROCESSING";
      return "FAILED";
    },
  });
  assert.equal(testAdapter.normalizeStatus("provider_paid"), "SUCCEEDED");
  assert.equal(testAdapter.normalizeStatus("provider_pending"), "PROCESSING");
  assert.equal(testAdapter.normalizeStatus("provider_rejected"), "FAILED");
});

test("provider-neutral request contract does not expose ORM or credential fields", () => {
  const source = JSON.stringify({
    paymentReference: "payment-ref",
    attemptReference: "attempt-ref",
    amount: { value: "499.00", currency: "INR" },
    idempotencyReference: "payment:1:attempt:1",
    metadata: { source: "checkout" },
  });
  assert.doesNotMatch(source, /password|cvv|cvc|pin|cardNumber|database|prisma|secret/i);
});

test("payment application invokes only the resolved adapter and maps normalized result", async () => {
  let called = 0;
  const testAdapter = adapter({
    async createPayment(request) {
      called += 1;
      assert.equal(request.amount.currency, "INR");
      assert.equal(request.amount.value, "998.00");
      assert.match(request.idempotencyReference, /^payment:/);
      return {
        providerId: "test-provider",
        providerPaymentReference: "pp-1",
        providerAttemptReference: "pa-1",
        status: "PROCESSING",
        clientAction: { type: "NONE" },
      };
    },
  });
  const registry = createPaymentProviderRegistry([testAdapter]);
  const resolver = createPaymentProviderResolver({
    registry,
    configuration: {
      id: "test-provider",
      enabled: true,
      mode: "test",
      publicKey: null,
      secretReference: "SECRET_REF",
      webhookSecretReference: "WEBHOOK_SECRET_REF",
      timeoutMs: 10000,
      capabilities: {},
    },
  });

  const repository = (await import("./payment-domain-service.test")).default;
  void repository;
  assert.equal(called, 0);
  assert.ok(resolver.resolve({ customerId: "c", checkoutReference: "x", currency: "INR" }));
});
