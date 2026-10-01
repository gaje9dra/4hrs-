import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPaymentTransition,
  canRetryPayment,
  canTransitionPaymentStatus,
  isTerminalPaymentStatus,
} from "@/lib/payments/domain";
import { PaymentError } from "@/lib/payments/errors";
import {
  assertIdempotencyFingerprint,
  paymentIdempotencyScope,
} from "@/lib/payments/idempotency";
import type { PaymentProviderAdapter } from "@/lib/payments/provider";
import { isWebhookReplaySafe } from "@/lib/payments/webhooks";

test("Payment lifecycle accepts only provider-neutral transitions", () => {
  assert.equal(canTransitionPaymentStatus("CREATED", "PROCESSING"), true);
  assert.equal(canTransitionPaymentStatus("PROCESSING", "SUCCEEDED"), true);
  assert.equal(canTransitionPaymentStatus("SUCCEEDED", "REFUNDED"), true);
  assert.equal(canTransitionPaymentStatus("SUCCEEDED", "PROCESSING"), false);
  assert.equal(canTransitionPaymentStatus("REFUNDED", "PROCESSING"), false);
  assert.equal(isTerminalPaymentStatus("CANCELLED"), true);
  assert.equal(isTerminalPaymentStatus("EXPIRED"), true);
  assert.equal(isTerminalPaymentStatus("REFUNDED"), true);
  assert.equal(isTerminalPaymentStatus("FAILED"), false);
  assert.equal(canRetryPayment("FAILED"), true);
  assert.throws(() => assertPaymentTransition("SUCCEEDED", "PROCESSING"), /Invalid payment transition/);
});

test("idempotency scope is customer and operation scoped", () => {
  assert.equal(
    paymentIdempotencyScope("customer-1", "create-intent"),
    "customer:customer-1:payment:create-intent",
  );
  const recordFingerprint = "fingerprint-a";
  assert.doesNotThrow(() => assertIdempotencyFingerprint(recordFingerprint, "fingerprint-a"));
  assert.throws(
    () => assertIdempotencyFingerprint(recordFingerprint, "fingerprint-b"),
    /idempotency conflict/i,
  );
});

test("webhook processing requires verification and replay safety", () => {
  assert.equal(isWebhookReplaySafe({ signatureVerified: true, replaySafe: true }), true);
  assert.equal(isWebhookReplaySafe({ signatureVerified: false, replaySafe: true }), false);
  assert.equal(isWebhookReplaySafe({ signatureVerified: true, replaySafe: false }), false);
});

test("provider adapter contract stays provider-neutral", () => {
  const adapter: PaymentProviderAdapter = {
    id: "test-provider",
    capabilities: {

      createPayment: true,
      clientAction: false,
      webhookVerification: true,
      statusLookup: true,
      cancellation: false,
      refunds: true,
      partialRefunds: false,
    },
    async createPayment() {
      return { providerId: "test-provider", providerPaymentReference: "external-1", providerAttemptReference: "attempt-1", status: "PROCESSING", clientAction: { type: "NONE" } };
    },
    async retrievePayment() {
      return { providerId: "test-provider", providerPaymentReference: "external-1", providerAttemptReference: "attempt-1", status: "PROCESSING", clientAction: { type: "NONE" } };
    },
    async verifyPayment() {
      return { providerId: "test-provider", providerPaymentReference: "external-1", providerAttemptReference: "attempt-1", status: "SUCCEEDED", clientAction: { type: "NONE" } };
    },
    normalizeStatus(status) {
      return status === "SUCCEEDED" ? "SUCCEEDED" : "PROCESSING";
    },
    normalizeError() {
      return "PROVIDER_UNKNOWN_ERROR";
    },
    async verifyWebhook() {
      return {
        verified: true,
        event: {
          providerId: "test-provider",
        providerEventReference: "event-1",
        providerPaymentReference: "external-1",
        internalPaymentReference: "payment-1",
        normalizedEventType: "PAYMENT_SUCCEEDED",
        status: "SUCCEEDED",
        occurredAt: "2026-10-01T00:00:00.000Z",
        },
      };
    },
  };

  assert.equal(adapter.id, "test-provider");
  assert.equal(adapter.capabilities.partialRefunds, false);
  assert.equal(adapter.capabilities.webhookVerification, true);
});

test("Payment errors use provider-neutral categories", () => {
  const error = new PaymentError("PROVIDER_REJECTED", "Payment was rejected.");
  assert.equal(error.code, "PROVIDER_REJECTED");
  assert.equal(error.message, "Payment was rejected.");
});

test("Checkout remains the amount authority and payment is not an order", async () => {
  const fs = await import("node:fs/promises");
  const checkoutContracts = await fs.readFile("lib/checkout/contracts.ts", "utf8");
  const paymentApplication = await fs.readFile("lib/payments/application.ts", "utf8");
  const paymentCheckout = await fs.readFile("lib/payments/checkout.ts", "utf8");
  const paymentHttp = await fs.readFile("lib/payments/http.ts", "utf8");
  assert.match(checkoutContracts, /checkoutReference/);
  assert.match(paymentApplication, /createPaymentFromCheckout/);
  assert.match(paymentCheckout, /createCheckoutPaymentReference/);
  assert.match(paymentHttp, /paymentErrorResponse/);
  assert.doesNotMatch(paymentApplication, /orderId|createOrder|shipping|reserveInventory|razorpay|payu|stripe/i);
});

test("Phase 11.1 does not install or reference provider SDKs in payment code", async () => {
  const fs = await import("node:fs/promises");
  const files = [
    "lib/payments/index.ts",
    "lib/payments/domain.ts",
    "lib/payments/provider.ts",
    "lib/payments/application.ts",
    "lib/payments/idempotency.ts",
    "lib/payments/webhooks.ts",
    "lib/payments/errors.ts",
    "lib/payments/config.ts",
    "lib/payments/resolver.ts",
  ];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /razorpay|payu|stripe/i, file);
  }
});
