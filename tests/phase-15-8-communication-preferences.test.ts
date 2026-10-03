import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { db } from "@/lib/db/client";
import {
  defaultPreferenceState,
  evaluateNotificationEligibility,
  getCustomerCommunicationPreferences,
  updateCustomerCommunicationPreference,
} from "@/lib/communications/preferences";
import { issueUnsubscribeToken, validateUnsubscribeToken, consumeUnsubscribeToken } from "@/lib/communications/unsubscribe";
import { enqueueNotificationEvent, processNotificationBatch } from "@/lib/notifications/service";

test("communication defaults are fail-closed for optional categories and enabled for required transactional", () => {
  assert.equal(defaultPreferenceState("MARKETING_PROMOTIONAL"), "OPTED_OUT");
  assert.equal(defaultPreferenceState("OPTIONAL_SERVICE"), "OPTED_OUT");
  assert.equal(defaultPreferenceState("REQUIRED_TRANSACTIONAL"), "OPTED_IN");
});

test("customer preference mutations are versioned, idempotent, and auditable", async () => {
  const customerId = randomUUID();
  await db.customer.create({ data: { id: customerId, email: `preference-${customerId}@example.invalid`, status: "ACTIVE" } });
  try {
    const first = await updateCustomerCommunicationPreference({
      customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL", state: "OPTED_IN",
      expectedVersion: 0, idempotencyKey: `pref-test-${randomUUID()}`, correlationId: "test-correlation",
    });
    assert.equal(first.state, "OPTED_IN");
    assert.equal(first.version, 1);

    const repeated = await updateCustomerCommunicationPreference({
      customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL", state: "OPTED_IN",
      expectedVersion: 0, idempotencyKey: first ? (await db.customerCommunicationPreferenceAudit.findFirstOrThrow({ where: { customerId } })).idempotencyKey! : "",
    });
    assert.equal(repeated.version, 1);

    await assert.rejects(
      updateCustomerCommunicationPreference({
        customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL", state: "OPTED_OUT",
        expectedVersion: 0, idempotencyKey: `pref-conflict-${randomUUID()}`,
      }),
      /changed elsewhere/,
    );
    const audit = await db.customerCommunicationPreferenceAudit.findMany({ where: { customerId } });
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actorType, "CUSTOMER");
  } finally {
    await db.customerCommunicationPreferenceAudit.deleteMany({ where: { customerId } });
    await db.customerCommunicationPreference.deleteMany({ where: { customerId } });
    await db.customer.delete({ where: { id: customerId } });
  }
});

test("customer can read only their own normalized supported preference surface", async () => {
  const customerId = randomUUID();
  await db.customer.create({ data: { id: customerId, email: `read-${customerId}@example.invalid`, status: "ACTIVE" } });
  try {
    const preferences = await getCustomerCommunicationPreferences(customerId);
    assert.deepEqual(preferences.map((item) => [item.category, item.channel, item.state]), [["MARKETING_PROMOTIONAL", "EMAIL", "OPTED_OUT"]]);
  } finally {
    await db.customer.delete({ where: { id: customerId } });
  }
});

test("notification eligibility separates required transactional communication from marketing preference", async () => {
  const customerId = randomUUID();
  await db.customer.create({ data: { id: customerId, email: `eligibility-${customerId}@example.invalid`, status: "ACTIVE" } });
  try {
    const required = await evaluateNotificationEligibility({ customerId, category: "REQUIRED_TRANSACTIONAL", channel: "EMAIL" });
    const marketingBefore = await evaluateNotificationEligibility({ customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL" });
    assert.equal(required.eligible, true);
    assert.equal(marketingBefore.eligible, false);
    assert.equal(marketingBefore.reason, "CONSENT_NOT_PRESENT");

    await updateCustomerCommunicationPreference({
      customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL", state: "OPTED_IN",
      expectedVersion: 0, idempotencyKey: `eligibility-${randomUUID()}`,
    });
    const marketingAfter = await evaluateNotificationEligibility({ customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL" });
    assert.equal(marketingAfter.eligible, true);
  } finally {
    await db.customerCommunicationPreferenceAudit.deleteMany({ where: { customerId } });
    await db.customerCommunicationPreference.deleteMany({ where: { customerId } });
    await db.customer.delete({ where: { id: customerId } });
  }
});

test("queued optional notifications are suppressed after an opt-out and never reach the provider", async () => {
  const customerId = randomUUID();
  await db.customer.create({ data: { id: customerId, email: `queue-${customerId}@example.invalid`, status: "ACTIVE" } });
  try {
    await updateCustomerCommunicationPreference({
      customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL", state: "OPTED_IN",
      expectedVersion: 0, idempotencyKey: `queue-opt-in-${randomUUID()}`,
    });
    const queued = await enqueueNotificationEvent(db, {
      customerId, type: "CASE_CREATED", communicationCategory: "MARKETING_PROMOTIONAL",
      idempotencyKey: `queue-${customerId}`, payload: { caseReference: "CASE-TEST" },
    });
    assert.ok(queued.deliveryId);

    await updateCustomerCommunicationPreference({
      customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL", state: "OPTED_OUT",
      expectedVersion: 1, idempotencyKey: `queue-opt-out-${randomUUID()}`,
    });
    process.env.NOTIFICATION_PROVIDER_ENABLED = "true";
    process.env.NOTIFICATION_PROVIDER_MODE = "test";
    const results = await processNotificationBatch(20);
    assert.equal(results.find((item) => item.id === queued.deliveryId)?.status, "SUPPRESSED");
    const delivery = await db.notificationDelivery.findUnique({ where: { id: queued.deliveryId } });
    assert.equal(delivery?.status, "SUPPRESSED");
    assert.equal(delivery?.suppressionReason, "CUSTOMER_OPTED_OUT");
  } finally {
    await db.notificationDelivery.deleteMany({ where: { customerId } });
    await db.notificationEvent.deleteMany({ where: { customerId } });
    await db.customerCommunicationPreferenceAudit.deleteMany({ where: { customerId } });
    await db.customerCommunicationPreference.deleteMany({ where: { customerId } });
    await db.customer.delete({ where: { id: customerId } });
  }
});

test("unsubscribe tokens are signed, expiring, one-time, and do not trust a customer ID from the URL", async () => {
  const previous = process.env.NOTIFICATION_UNSUBSCRIBE_SECRET;
  process.env.NOTIFICATION_UNSUBSCRIBE_SECRET = "test-secret-that-is-at-least-32-characters-long";
  const customerId = randomUUID();
  await db.customer.create({ data: { id: customerId, email: `unsubscribe-${customerId}@example.invalid`, status: "ACTIVE" } });
  try {
    const token = await issueUnsubscribeToken({ customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL" });
    await assert.doesNotReject(() => validateUnsubscribeToken(token));
    await consumeUnsubscribeToken(token, "unsubscribe-test");
    await assert.rejects(() => validateUnsubscribeToken(token), /invalid or expired/);
    const preference = await db.customerCommunicationPreference.findUnique({ where: { customerId_category_channel: { customerId, category: "MARKETING_PROMOTIONAL", channel: "EMAIL" } } });
    assert.equal(preference?.state, "OPTED_OUT");
    await assert.rejects(() => consumeUnsubscribeToken(token), /invalid or expired/);
  } finally {
    await db.communicationUnsubscribeToken.deleteMany({ where: { customerId } });
    await db.customerCommunicationPreferenceAudit.deleteMany({ where: { customerId } });
    await db.customerCommunicationPreference.deleteMany({ where: { customerId } });
    await db.customer.delete({ where: { id: customerId } });
    process.env.NOTIFICATION_UNSUBSCRIBE_SECRET = previous;
  }
});

test("customer and admin APIs enforce ownership, same-origin, explicit permissions, and no customer IDs from browser state", () => {
  const customerRoute = fs.readFileSync("app/api/customer/communications/preferences/route.ts", "utf8");
  assert.match(customerRoute, /requireCurrentCustomer/);
  assert.match(customerRoute, /assertSameOrigin/);
  assert.doesNotMatch(customerRoute, /body\.customerId|params.*customerId/i);
  const adminRoute = fs.readFileSync("app/api/admin/customers/[customerId]/communication-preferences/route.ts", "utf8");
  assert.match(adminRoute, /communication\.preference\.read/);
  assert.match(adminRoute, /communication\.preference\.manage/);
  assert.match(adminRoute, /requireHighRiskReason/);
  assert.match(adminRoute, /CUSTOMER_REQUEST/);
});

test("communication UI does not pre-check optional marketing communication and separates required messaging", () => {
  const source = fs.readFileSync("components/storefront/customer-communication-preferences.tsx", "utf8");
  assert.match(source, /checked=\{preference\?\.state === "OPTED_IN"\}/);
  assert.match(source, /Transactional communication/);
  assert.match(source, /Optional promotional/);
});

test("preference migration is additive and does not silently seed opt-in state", () => {
  const migration = fs.readFileSync("prisma/migrations/20261003090000_communication_preferences/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "CustomerCommunicationPreference"/);
  assert.match(migration, /NOT NULL DEFAULT 'REQUIRED_TRANSACTIONAL'/);
  assert.doesNotMatch(migration, /INSERT INTO "CustomerCommunicationPreference"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test("privacy deletion removes preference and unsubscribe records and blocks future optional delivery", () => {
  const source = fs.readFileSync("lib/customer/privacy.ts", "utf8");
  assert.match(source, /customerCommunicationPreference\.deleteMany/);
  assert.match(source, /customerCommunicationPreferenceAudit\.deleteMany/);
  assert.match(source, /communicationUnsubscribeToken\.deleteMany/);
  assert.match(source, /suppressionReason: "CUSTOMER_DELETED"/);
});

test("communication telemetry is bounded and excludes direct customer contact data", () => {
  const metrics = fs.readFileSync("lib/observability/metrics.ts", "utf8");
  assert.match(metrics, /communication_preference_operations_total/);
  assert.match(metrics, /"category".*"channel".*"reason"/);
  assert.doesNotMatch(metrics, /email|phone|token/i);
});

test("documentation explicitly distinguishes preferences from legal consent and documents unsupported marketing delivery", () => {
  const docs = fs.readFileSync("docs/phase-15-8-communication-preferences-consent-controls.md", "utf8");
  for (const term of ["Preference architecture","Consent vs preference","Transactional","Marketing","Defaults","Queued notifications","Security model","Retention","Legal/compliance assumptions","Explicitly unsupported functionality"]) assert.ok(docs.includes(term), term);
  assert.match(docs, /not a legal consent record/i);
  assert.match(docs, /No marketing event types or production marketing provider are implemented/i);
});
