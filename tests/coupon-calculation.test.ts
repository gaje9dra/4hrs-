import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { calculateCouponDiscount, CouponEligibilityError } from "../lib/coupons/calculation.ts";

const coupon = (overrides: Record<string, unknown> = {}) => ({
  code: "SAVE10", status: "ACTIVE" as const, discountPercent: 10,
  startsAt: null, expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  minimumSubtotal: null, maximumDiscountAmount: null, ...overrides,
});

test("calculates percentage discounts with two-decimal rounding", () => {
  assert.equal(calculateCouponDiscount({ coupon: coupon({ discountPercent: 1 }), eligibleSubtotal: "999.99", currency: "INR", now: new Date("2029-01-01") }).discountAmount, "10.00");
  assert.equal(calculateCouponDiscount({ coupon: coupon(), eligibleSubtotal: "999.99", currency: "INR", now: new Date("2029-01-01") }).discountAmount, "100.00");
  assert.equal(calculateCouponDiscount({ coupon: coupon({ discountPercent: 20 }), eligibleSubtotal: "1000", currency: "INR", now: new Date("2029-01-01") }).discountAmount, "200.00");
  assert.equal(calculateCouponDiscount({ coupon: coupon({ discountPercent: 50 }), eligibleSubtotal: "1000", currency: "INR", now: new Date("2029-01-01") }).discountAmount, "500.00");
});

test("respects maximum discount and never discounts beyond subtotal", () => {
  assert.equal(calculateCouponDiscount({ coupon: coupon({ discountPercent: 50, maximumDiscountAmount: new Prisma.Decimal("75") }), eligibleSubtotal: "100", currency: "INR", now: new Date("2029-01-01") }).discountAmount, "75.00");
  assert.throws(() => calculateCouponDiscount({ coupon: coupon({ discountPercent: 100, maximumDiscountAmount: null }), eligibleSubtotal: "0.01", currency: "INR", now: new Date("2029-01-01") }), CouponEligibilityError);
});

test("rejects subtotal below minimum and invalid coupon status or dates", () => {
  assert.throws(() => calculateCouponDiscount({ coupon: coupon({ minimumSubtotal: new Prisma.Decimal("500") }), eligibleSubtotal: "499.99", currency: "INR", now: new Date("2029-01-01") }), CouponEligibilityError);
  assert.throws(() => calculateCouponDiscount({ coupon: coupon({ status: "INACTIVE" }), eligibleSubtotal: "100", currency: "INR", now: new Date("2029-01-01") }), CouponEligibilityError);
  assert.throws(() => calculateCouponDiscount({ coupon: coupon({ startsAt: new Date("2030-01-01") }), eligibleSubtotal: "100", currency: "INR", now: new Date("2029-01-01") }), CouponEligibilityError);
  assert.throws(() => calculateCouponDiscount({ coupon: coupon({ expiresAt: new Date("2028-01-01") }), eligibleSubtotal: "100", currency: "INR", now: new Date("2029-01-01") }), CouponEligibilityError);
});
