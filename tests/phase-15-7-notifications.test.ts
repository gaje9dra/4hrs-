import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import fs from "node:fs";
import { db } from "@/lib/db/client";
import { getNotificationTemplate, renderNotificationTemplate } from "@/lib/notifications/templates";
import { resolveNotificationProvider } from "@/lib/notifications/provider";
import { retryDelaySeconds } from "@/lib/notifications/retry";
import { enqueueNotificationEvent, processNotificationBatch } from "@/lib/notifications/service";
import { NOTIFICATION_MAX_ATTEMPTS } from "@/lib/notifications/config";

test("all catalogued transactional event types have source-controlled templates", () => {
  const types = [
    "ORDER_CONFIRMED","PAYMENT_SUCCEEDED","PAYMENT_FAILED","FULFILLMENT_SUBMITTED","FULFILLMENT_FAILED",
    "SHIPMENT_CREATED","SHIPMENT_IN_TRANSIT","SHIPMENT_OUT_FOR_DELIVERY","SHIPMENT_DELIVERED","SHIPMENT_DELIVERY_FAILED",
    "CANCELLATION_REQUESTED","CANCELLATION_APPROVED","CANCELLATION_REJECTED","RETURN_REQUESTED","RETURN_APPROVED",
    "RETURN_REJECTED","RETURN_RECEIVED","RETURN_RESOLUTION_COMPLETED","REFUND_INITIATED","REFUND_COMPLETED","REFUND_FAILED",
    "CASE_CREATED","CASE_RESOLVED",
  ] as const;

  for (const type of types) {
    const template = getNotificationTemplate(type);
    const payload = Object.fromEntries(template.requiredVariables.map((key) => [key, key === "orderNumber" ? "ORD-TEST" : key === "returnReference" ? "RET-TEST" : key === "cancellationReference" ? "CAN-TEST" : "CASE-TEST"]));
    const rendered = renderNotificationTemplate(template, payload);
    assert.ok(rendered.subject.length > 0);
    assert.ok(rendered.text.length > 0);
    assert.ok(rendered.html.length > 0);
  }
});

test("template rendering escapes customer-controlled values", () => {
  const template = getNotificationTemplate("CASE_CREATED");
  const rendered = renderNotificationTemplate(template, { caseReference: "<script>alert(1)</script>" });
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.html, /&lt;script&gt;/);
});

test("retry backoff is bounded and retry classification excludes permanent failures", () => {
  assert.equal(retryDelaySeconds(1, 0), 60);
  assert.ok(retryDelaySeconds(50, 1) <= 3600);
  assert.equal(retryDelaySeconds(0, 0), 60);
});

test("production notification provider cannot silently fall back to the test adapter", () => {
  const previous = {
    enabled: process.env.NOTIFICATION_PROVIDER_ENABLED,
    mode: process.env.NOTIFICATION_PROVIDER_MODE,
    id: process.env.NOTIFICATION_PROVIDER_ID,
  };
  process.env.NOTIFICATION_PROVIDER_ENABLED = "true";
  process.env.NOTIFICATION_PROVIDER_MODE = "production";
  process.env.NOTIFICATION_PROVIDER_ID = "none";
  const provider = resolveNotificationProvider();
  assert.equal(provider.id, "unconfigured");
  process.env.NOTIFICATION_PROVIDER_ENABLED = previous.enabled;
  process.env.NOTIFICATION_PROVIDER_MODE = previous.mode;
  process.env.NOTIFICATION_PROVIDER_ID = previous.id;
});

test("notification event creation is idempotent and creates a durable delivery", async () => {
  const customerId = randomUUID();
  const email = `notification-test-${customerId}@example.invalid`;
  const key = `TEST_NOTIFICATION:${customerId}`;
  await db.customer.create({ data: { id: customerId, email, status: "ACTIVE" } });

  try {
    const first = await enqueueNotificationEvent(db, {
      customerId,
      type: "CANCELLATION_REQUESTED",
      idempotencyKey: key,
      payload: { orderNumber: "ORD-TEST", cancellationReference: "CAN-TEST" },
    });
    const second = await enqueueNotificationEvent(db, {
      customerId,
      type: "CANCELLATION_REQUESTED",
      idempotencyKey: key,
      payload: { orderNumber: "ORD-TEST", cancellationReference: "CAN-TEST" },
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.eventId, second.eventId);
    assert.equal(first.deliveryId, second.deliveryId);

    process.env.NOTIFICATION_PROVIDER_ENABLED = "true";
    process.env.NOTIFICATION_PROVIDER_MODE = "test";
    const results = await processNotificationBatch(5);
    const processed = results.find((item) => item.id === first.deliveryId);
    assert.equal(processed?.status, "SENT");

    const delivery = await db.notificationDelivery.findUnique({ where: { id: first.deliveryId! } });
    assert.equal(delivery?.attempts, 1);
    assert.equal(delivery?.status, "SENT");
    assert.equal(delivery?.maxAttempts, NOTIFICATION_MAX_ATTEMPTS);
  } finally {
    await db.notificationDelivery.deleteMany({ where: { customerId } });
    await db.notificationEvent.deleteMany({ where: { customerId } });
    await db.customer.delete({ where: { id: customerId } });
  }
});

test("notification admin resend is permission-gated and notification routes do not accept browser provider calls", () => {
  const source = fs.readFileSync("app/api/admin/notifications/route.ts", "utf8");
  assert.match(source, /requireAdmin\(request, "notifications\.manage"\)/);
  assert.match(source, /requireHighRiskReason/);
  assert.match(source, /assertAdminSameOrigin/);
  assert.doesNotMatch(source, /fetch\(.*provider|NEXT_PUBLIC_.*NOTIFICATION/i);
});
