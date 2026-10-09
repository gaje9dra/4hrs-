import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { reserveCouponForCheckout } from "@/lib/coupons/redemptions";

const databaseUrl = (() => { try { return new URL(process.env.DATABASE_URL ?? ""); } catch { return null; } })();
const safeTestDatabase = process.env.CI === "true" && Boolean(databaseUrl) && (
  databaseUrl!.pathname.toLowerCase().includes("test") ||
  ["localhost", "127.0.0.1", "postgres", "db"].includes(databaseUrl!.hostname.toLowerCase())
);

test("PostgreSQL coupon reservation never exceeds configured capacity under concurrency", { skip: !safeTestDatabase }, async () => {
  const customer = await db.customer.create({ data: { email: "coupon-concurrency-" + randomUUID() + "@example.test" } });
  const coupon = await db.discountCoupon.create({
    data: {
      code: "T" + randomUUID().replaceAll("-", "").slice(0, 15).toUpperCase(),
      discountPercent: 10,
      maxRedemptions: 10,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });
  try {
    const attempts = await Promise.allSettled(Array.from({ length: 30 }, (_, index) =>
      reserveCouponForCheckout({
        customerId: customer.id,
        checkoutReference: "test-" + randomUUID() + "-" + index,
        code: coupon.code,
        eligibleSubtotal: "100.00",
        currency: "INR",
      }),
    ));
    const accepted = attempts.filter((result) => result.status === "fulfilled");
    const rows = await db.couponRedemption.findMany({ where: { couponId: coupon.id } });
    const counted = rows.filter((row) => row.status === "REDEEMED" || row.status === "RESERVED");
    assert.ok(accepted.length <= 10, "accepted reservations must not exceed maxRedemptions");
    assert.ok(counted.length <= 10, "persisted completed plus reserved redemptions must not exceed maxRedemptions");
    assert.equal(new Set(rows.map((row) => row.checkoutReference)).size, rows.length, "each checkout must own a unique reservation");
    if (rows[0]?.checkoutReference) {
      const repeated = await reserveCouponForCheckout({ customerId: customer.id, checkoutReference: rows[0].checkoutReference, code: coupon.code, eligibleSubtotal: "100.00", currency: "INR" });
      assert.equal(repeated.id, rows[0].id, "retrying the same checkout must reuse its original reservation");
    }
  } finally {
    await db.couponRedemption.deleteMany({ where: { couponId: coupon.id } });
    await db.discountCoupon.delete({ where: { id: coupon.id } });
    await db.customer.delete({ where: { id: customer.id } });
  }
});


test("PostgreSQL coupon reservation enforces per-customer usage limits", { skip: !safeTestDatabase }, async () => {
  const customer = await db.customer.create({ data: { email: "coupon-per-customer-" + randomUUID() + "@example.test" } });
  const coupon = await db.discountCoupon.create({
    data: {
      code: "P" + randomUUID().replaceAll("-", "").slice(0, 15).toUpperCase(),
      discountPercent: 10,
      maxRedemptions: 5,
      perCustomerLimit: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });
  try {
    await reserveCouponForCheckout({ customerId: customer.id, checkoutReference: "per-customer-" + randomUUID(), code: coupon.code, eligibleSubtotal: "100.00", currency: "INR" });
    await assert.rejects(
      () => reserveCouponForCheckout({ customerId: customer.id, checkoutReference: "per-customer-" + randomUUID(), code: coupon.code, eligibleSubtotal: "100.00", currency: "INR" }),
      /usage limit/,
    );
  } finally {
    await db.couponRedemption.deleteMany({ where: { couponId: coupon.id } });
    await db.discountCoupon.delete({ where: { id: coupon.id } });
    await db.customer.delete({ where: { id: customer.id } });
  }
});
