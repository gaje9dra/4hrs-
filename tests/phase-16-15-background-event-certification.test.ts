import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(path, "utf8");
}

test("Phase 16.15 inventory has one real scheduled worker and no duplicate queue architecture", async () => {
  const fn = await read("netlify/functions/process-notifications.mts");
  const pkg = await read("package.json");
  assert.match(fn, /schedule:\s*"\*\/5 \* \* \* \*"/);
  assert.match(fn, /processNotificationBatch/);
  assert.match(pkg, /"production-certification:phase-16-15"/);
  assert.doesNotMatch(pkg, /bullmq|@temporalio|bull\b|rabbitmq|kafka/i);
});

test("notification worker has atomic claim, bounded retry and stale-processing recovery", async () => {
  const service = await read("lib/notifications/service.ts");
  const config = await read("lib/notifications/config.ts");
  assert.match(service, /updateMany/);
  assert.match(service, /status: "PROCESSING"/);
  assert.match(service, /processingLeaseCutoff/);
  assert.match(service, /P2002/);
  assert.match(service, /deliveryIdempotencyKey/);
  assert.match(service, /retryDelaySeconds/);
  assert.match(config, /NOTIFICATION_MAX_ATTEMPTS = 5/);
  assert.match(config, /NOTIFICATION_PROCESSING_LEASE_SECONDS = 120/);
});

test("payment async processing is signature-verified and durably deduplicated", async () => {
  const route = await read("app/api/payment/webhook/[providerId]/route.ts");
  const app = await read("lib/payments/application.ts");
  const repo = await read("lib/payments/repository.ts");
  assert.match(route, /verifyWebhook/);
  assert.match(route, /webhookVerification/);
  assert.match(app, /recordPaymentEvent/);
  assert.match(app, /processingStatus === "PROCESSED"/);
  assert.match(app, /markPaymentEventProcessed/);
  assert.match(repo, /providerId_providerEventId/);
});

test("fulfillment and shipping async boundaries are idempotent and concurrency-aware", async () => {
  const fulfillment = await read("lib/fulfillment/application.ts");
  const shipping = await read("lib/shipping/application.ts");
  const shippingRepo = await read("lib/shipping/repository.ts");
  const shippingRetry = await read("lib/shipping/retry.ts");
  assert.match(fulfillment, /getByIdempotencyKey/);
  assert.match(fulfillment, /P2034/);
  assert.match(shipping, /SHIPMENT_IDEMPOTENCY_CONFLICT/);
  assert.match(shipping, /Serializable/);
  assert.match(shippingRepo, /createTrackingEventIfNew/);
  assert.match(shippingRepo, /deduplicationKey/);
  assert.match(shippingRetry, /AMBIGUOUS/);
  assert.match(shippingRetry, /SHIPMENT_CREATE/);
});

test("Qikink remains behind the server-side fulfillment provider boundary", async () => {
  const qikink = await read("lib/fulfillment/providers/qikink.ts");
  const provider = await read("lib/fulfillment/provider.ts");
  assert.doesNotMatch(qikink, /["']use client["']/);
  assert.match(provider, /FulfillmentProvider/);
  assert.match(qikink, /Qikink/);
});

test("Phase 16.15 does not claim external production evidence", async () => {
  const script = await read("scripts/phase-16-15-background-event-certification.ts");
  assert.match(script, /repository_static_certification/);
  assert.match(script, /Netlify scheduler delivery history/);
  assert.match(script, /real payment-provider callback delivery/);
  assert.match(script, /Phase 16.16 is not implemented/);
});
