import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { validateCheckoutForOrder, type OrderCheckoutSnapshot, type OrderPaymentSnapshot } from "@/lib/orders/domain";

const checkout = (overrides: Partial<OrderCheckoutSnapshot> = {}): OrderCheckoutSnapshot => ({
  checkoutReference: "checkout-coupon-test",
  cartId: "cart-1",
  address: {
    recipientName: "Test Customer",
    phone: null,
    addressLine1: "1 Test Street",
    addressLine2: null,
    city: "Jaipur",
    stateOrProvince: "Rajasthan",
    postalCode: "302001",
    countryCode: "IN",
    label: null,
  },
  items: [{
    id: "item-1", productId: "product-1", variantId: "variant-1", productTitle: "Test Tee",
    variantTitle: "Black / M", sku: "TEE-M", selectedOptions: { size: "M" }, quantity: 2,
    unitPrice: "50.00", lineTotal: "100.00", currency: "INR",
  }],
  subtotal: "100.00",
  discountTotal: "10.00",
  couponCode: "SAVE10",
  couponDiscountPercent: 10,
  total: "90.00",
  currency: "INR",
  ...overrides,
});

const payment = (amount: string): OrderPaymentSnapshot => ({
  id: "payment-1",
  customerId: "customer-1",
  checkoutReference: "checkout-coupon-test",
  status: "SUCCEEDED",
  amount: new Prisma.Decimal(amount),
  currency: "INR",
  completedAt: new Date("2026-10-09T00:00:00.000Z"),
});

test("order financial validation accepts authoritative coupon-discounted total", () => {
  assert.doesNotThrow(() => validateCheckoutForOrder(checkout(), payment("90.00")));
});

test("order financial validation rejects a payment amount that ignores the coupon discount", () => {
  assert.throws(() => validateCheckoutForOrder(checkout(), payment("100.00")), /amount does not match/);
});

test("order financial validation rejects discounts larger than subtotal", () => {
  assert.throws(() => validateCheckoutForOrder(checkout({ discountTotal: "101.00", total: "0.00" }), payment("0.00")), /discount is invalid/);
});

test("order financial validation rejects inconsistent payable totals", () => {
  assert.throws(() => validateCheckoutForOrder(checkout({ total: "89.99" }), payment("89.99")), /totals are internally inconsistent/);
});
