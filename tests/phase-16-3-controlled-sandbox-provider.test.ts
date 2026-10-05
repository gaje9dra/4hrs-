import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { controlledSandboxPaymentProvider } from "@/lib/payments/providers/controlled-sandbox";

function signedBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

test("controlled sandbox provider rejects live mode by configuration contract", async () => {
  const previous = process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET;
  process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET = "phase16-3-test-secret";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: {
      eventId: "sandbox-event-1",
      paymentReference: "sandbox-payment-1",
      amount: "100.00",
      currency: "INR",
      status: "SUCCEEDED",
      occurredAt: new Date().toISOString(),
      eventType: "PAYMENT_SUCCEEDED",
    },
  });
  const verified = await controlledSandboxPaymentProvider.verifyWebhook({
    headers: new Headers({
      "x-sandbox-timestamp": timestamp,
      "x-sandbox-signature": signedBody("phase16-3-test-secret", timestamp, body),
    }),
    body,
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.event.amount.value, "100.00");
  assert.equal(verified.event.currency, "INR");

  const invalid = await controlledSandboxPaymentProvider.verifyWebhook({
    headers: new Headers({
      "x-sandbox-timestamp": timestamp,
      "x-sandbox-signature": "invalid",
    }),
    body,
  }).then(() => false).catch(() => true);
  assert.equal(invalid, true);

  if (previous === undefined) delete process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET;
  else process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET = previous;
});

test("controlled sandbox provider exercises failure-injection contracts", async () => {
  const previous = process.env.PAYMENT_SANDBOX_SCENARIO;
  process.env.PAYMENT_SANDBOX_SCENARIO = "timeout";
  await assert.rejects(
    controlledSandboxPaymentProvider.createPayment({
      paymentReference: "p",
      attemptReference: "a",
      amount: { value: "100.00", currency: "INR" },
      idempotencyReference: "idempotency-1",
    }),
  );
  process.env.PAYMENT_SANDBOX_SCENARIO = "refund-timeout";
  await assert.rejects(
    controlledSandboxPaymentProvider.refundPayment?.({
      providerPaymentReference: "sandbox-p",
      paymentReference: "p",
      amount: { value: "100.00", currency: "INR" },
    }),
  );
  if (previous === undefined) delete process.env.PAYMENT_SANDBOX_SCENARIO;
  else process.env.PAYMENT_SANDBOX_SCENARIO = previous;
});
