import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { getReferralDashboard } from "@/lib/referrals/service";



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
