import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { getReferralDashboard, hasTrustedDeliveryEvidence, processReferralDeliveryReward } from "@/lib/referrals/service";


test("trusted delivery evidence rejects manual, wrong-provider, and post-delivery events", () => {
  const deliveredAt = new Date("2026-10-11T10:00:00.000Z");
  const event = { providerId: "supported-carrier", eventTimestamp: new Date("2026-10-11T09:59:00.000Z"), source: "WEBHOOK" as const };
  assert.equal(hasTrustedDeliveryEvidence({ shipmentProviderId: "supported-carrier", deliveredAt, events: [event] }), true);
  assert.equal(hasTrustedDeliveryEvidence({ shipmentProviderId: "supported-carrier", deliveredAt, events: [{ ...event, source: "MANUAL" }] }), false);
  assert.equal(hasTrustedDeliveryEvidence({ shipmentProviderId: "supported-carrier", deliveredAt, events: [{ ...event, providerId: "other-carrier" }] }), false);
  assert.equal(hasTrustedDeliveryEvidence({ shipmentProviderId: "supported-carrier", deliveredAt, events: [{ ...event, eventTimestamp: new Date("2026-10-11T10:01:00.000Z") }] }), false);
  assert.equal(hasTrustedDeliveryEvidence({ shipmentProviderId: "supported-carrier", deliveredAt, events: [] }), false);
});

const databaseUrl = (() => { try { return new URL(process.env.DATABASE_URL ?? ""); } catch { return null; } })();
const safeTestDatabase = process.env.CI === "true" && Boolean(databaseUrl) && (
  databaseUrl!.pathname.toLowerCase().includes("test") ||
  ["localhost", "127.0.0.1", "postgres", "db"].includes(databaseUrl!.hostname.toLowerCase())
);

test("referral profile is created on demand and customer dashboard excludes other customers' referrals", { skip: !safeTestDatabase }, async () => {
  const referrer = await db.customer.create({ data: { email: "referrer-" + randomUUID() + "@example.test" } });
  const invitee = await db.customer.create({ data: { email: "invitee-" + randomUUID() + "@example.test" } });
  const otherReferrer = await db.customer.create({ data: { email: "other-referrer-" + randomUUID() + "@example.test" } });
  const referrerProfile = await db.referralProfile.create({ data: { customerId: referrer.id, code: "T" + randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase() } });
  const otherProfile = await db.referralProfile.create({ data: { customerId: otherReferrer.id, code: "T" + randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase() } });
  const referral = await db.referral.create({
    data: { referrerCustomerId: referrer.id, invitedCustomerId: invitee.id, referralCodeSnapshot: referrerProfile.code, status: "AWAITING_ORDER" },
  });
  try {
    const dashboard = await getReferralDashboard(referrer.id);
    assert.equal(dashboard.referralCode, referrerProfile.code);
    assert.equal(dashboard.stats.total, 1);
    assert.equal(dashboard.referrals[0]?.id, referral.id);
    assert.equal(JSON.stringify(dashboard).includes(invitee.email), false, "customer dashboard must not expose invitee email");
    const inviteeDashboard = await getReferralDashboard(invitee.id);
    assert.equal(inviteeDashboard.stats.total, 0, "invitee must not inherit another customer's outgoing referral list");
    assert.notEqual(inviteeDashboard.referralCode, otherProfile.code);
  } finally {
    await db.referralReward.deleteMany({ where: { referralId: referral.id } });
    await db.discountCoupon.deleteMany({ where: { referralId: referral.id } });
    await db.referral.deleteMany({ where: { id: referral.id } });
    await db.referralProfile.deleteMany({ where: { customerId: { in: [referrer.id, invitee.id, otherReferrer.id] } } });
    await db.customer.deleteMany({ where: { id: { in: [referrer.id, invitee.id, otherReferrer.id] } } });
  }
});

test("delivery reward processor never rewards an absent or non-delivered shipment", { skip: !safeTestDatabase }, async () => {
  const result = await processReferralDeliveryReward(randomUUID());
  assert.deepEqual(result, { rewarded: false });
});
