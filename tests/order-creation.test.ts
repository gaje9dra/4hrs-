import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createOrderApplication } from "@/lib/orders/application";
import { OrderDomainError } from "@/lib/orders/errors";
import { createCheckoutPaymentReference } from "@/lib/payments/checkout";
import { syncReferralRewardLifecycleForPayment } from "@/lib/referrals/service";

const customers: string[] = [];
const addresses: string[] = [];
const carts: string[] = [];
const cartItems: string[] = [];
const products: string[] = [];
const variants: string[] = [];
const inventories: string[] = [];
const payments: string[] = [];
const orders: string[] = [];
const referralIds: string[] = [];
const refundIds: string[] = [];
const cancellationIds: string[] = [];
const couponRedemptionIds: string[] = [];

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fixture(options: {
  amount?: string;
  currency?: string;
  status?: "SUCCEEDED" | "FAILED";
} = {}) {
  const currency = options.currency ?? "INR";
  const customer = await db.customer.create({
    data: { email: `${randomUUID()}@order-creation.invalid`, displayName: "Creation Test Customer" },
  });
  customers.push(customer.id);

  const address = await db.customerAddress.create({
    data: {
      customerId: customer.id,
      recipientName: "Creation Test Customer",
      phone: "9999999999",
      addressLine1: "1 Test Street",
      city: "Jaipur",
      stateOrProvince: "Rajasthan",
      postalCode: "302001",
      countryCode: "IN",
      label: "Home",
      isDefault: true,
    },
  });
  addresses.push(address.id);

  const product = await db.product.create({
    data: {
      title: "Order Creation Tee",
      slug: `order-creation-${randomUUID()}`,
      price: new Prisma.Decimal("499.00"),
      currency,
      status: "ACTIVE",
      variants: {
        create: {
          displayName: "Black / M",
          sku: `TEE-${randomUUID()}`,
          price: new Prisma.Decimal("499.00"),
          status: "ACTIVE",
        },
      },
    },
    include: { variants: true },
  });
  products.push(product.id);
  variants.push(product.variants[0].id);
  const inventory = await db.inventory.create({
    data: { variantId: product.variants[0].id, trackingEnabled: true, onHand: 10, reserved: 0 },
  });
  inventories.push(inventory.id);

  const cart = await db.cart.create({
    data: {
      customerId: customer.id,
      items: {
        create: {
          productId: product.id,
          variantId: product.variants[0].id,
          quantity: 1,
        },
      },
    },
    include: { items: true },
  });
  carts.push(cart.id);
  cartItems.push(cart.items[0].id);

  const itemId = cart.items[0].id;
  const structure = [itemId, product.id, product.variants[0].id, 1].join("|");
  const pricing = [itemId, "499.00", "499.00", currency].join("|");
  const availability = [itemId, "AVAILABLE", 1, product.id, product.variants[0].id].join("|");
  const revision = {
    cart: digest([cart.id, structure].join("\n")),
    pricing: digest([currency, pricing].join("\n")),
    availability: digest(availability),
  };
  const checkoutReference = createCheckoutPaymentReference(customer.id, {
    customer: { id: customer.id, email: customer.email, displayName: customer.displayName },
    cart: { id: cart.id },
    address: { id: address.id },
    totals: { total: "499.00", currency },
    revision,
    validation: { state: "VALID" },
  });

  const payment = await db.payment.create({
    data: {
      customerId: customer.id,
      checkoutReference,
      internalReference: `pay-${randomUUID()}`,
      status: options.status ?? "SUCCEEDED",
      amount: new Prisma.Decimal(options.amount ?? "499.00"),
      currency,
      completedAt: (options.status ?? "SUCCEEDED") === "SUCCEEDED" ? new Date() : null,
    },
  });
  payments.push(payment.id);

  return { customer, address, product, variant: product.variants[0], cart, checkoutReference, payment };
}

function appFor(customerId: string) {
  return createOrderApplication({
    resolveCustomer: async () => ({ id: customerId }),
  });
}

async function expectCode(work: () => Promise<unknown>, code: OrderDomainError["code"]) {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof OrderDomainError);
    assert.equal(error.code, code);
    return true;
  });
}

test("creates one Order from a verified Payment with immutable snapshots", async () => {
  const f = await fixture();
  const result = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(result.id);

  assert.equal(result.customerId, f.customer.id);
  assert.equal(result.paymentId, f.payment.id);
  assert.equal(result.status, "PENDING");
  assert.equal(result.total, "499.00");
  assert.equal(result.currency, "INR");
  assert.match(result.orderNumber, /^ORD-[A-F0-9]{24}$/);

  const order = await db.order.findUniqueOrThrow({
    where: { id: result.id },
    include: { items: true, shippingAddress: true },
  });
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productTitleSnapshot, "Order Creation Tee");
  assert.equal(order.items[0].variantTitleSnapshot, "Black / M");
  assert.equal(order.items[0].skuSnapshot, f.variant.sku);
  assert.equal(order.items[0].unitPrice.toFixed(2), "499.00");
  assert.equal(order.items[0].lineTotal.toFixed(2), "499.00");
  assert.equal(order.shippingAddress?.addressLine1, "1 Test Street");
});

test("verified first eligible referred payment issues two 25% coupons without a shipment", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-order.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({ data: { referrerCustomerId: referrer.id, invitedCustomerId: f.customer.id, referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`, status: "AWAITING_ORDER" } });
  referralIds.push(referral.id);
  const result = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(result.id);
  const persisted = await db.referral.findUniqueOrThrow({ where: { id: referral.id } });
  const rewards = await db.referralReward.findMany({ where: { referralId: referral.id }, include: { coupon: true } });
  assert.equal(persisted.qualifyingOrderId, result.id);
  assert.equal(persisted.status, "REWARDED");
  assert.ok(persisted.paymentVerifiedAt);
  assert.equal(rewards.length, 2);
  assert.deepEqual(rewards.map((reward) => reward.coupon.discountPercent).sort(), [25, 25]);
  assert.ok(rewards.every((reward) => reward.coupon.maxRedemptions === 1 && reward.coupon.recipientCustomerId === reward.recipientCustomerId));
  assert.equal(await db.shipment.count({ where: { orderId: result.id } }), 0);
  const retried = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  assert.equal(retried.id, result.id);
  assert.equal(await db.referralReward.count({ where: { referralId: referral.id } }), 2);
});
test("pending refund blocks referral rewards and failed-refund retry recovers them", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-refund.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({ data: { referrerCustomerId: referrer.id, invitedCustomerId: f.customer.id, referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`, status: "AWAITING_ORDER" } });
  referralIds.push(referral.id);
  const refund = await db.paymentRefund.create({ data: { paymentId: f.payment.id, idempotencyKey: `referral-refund-${randomUUID()}`, amount: new Prisma.Decimal("10.00"), currency: f.payment.currency, reason: "CUSTOMER_REQUEST", status: "PENDING" } });
  refundIds.push(refund.id);
  const app = appFor(f.customer.id);
  const first = await app.createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(first.id);
  assert.equal((await db.referral.findUniqueOrThrow({ where: { id: referral.id } })).status, "AWAITING_PAYMENT_REVIEW");
  assert.equal(await db.referralReward.count({ where: { referralId: referral.id } }), 0);
  await db.paymentRefund.update({ where: { id: refund.id }, data: { status: "FAILED", completedAt: new Date(), failureCode: "TEST_REFUND_FAILED" } });
  const retried = await app.createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  assert.equal(retried.id, first.id);
  assert.equal((await db.referral.findUniqueOrThrow({ where: { id: referral.id } })).status, "REWARDED");
  assert.equal(await db.referralReward.count({ where: { referralId: referral.id } }), 2);
});
test("post-issuance pending refund deactivates unused referral coupons and failed refund restores them with audit", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-lifecycle.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({ data: { referrerCustomerId: referrer.id, invitedCustomerId: f.customer.id, referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`, status: "AWAITING_ORDER" } });
  referralIds.push(referral.id);
  const result = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(result.id);
  const rewards = await db.referralReward.findMany({ where: { referralId: referral.id }, include: { coupon: true } });
  assert.equal(rewards.length, 2);
  await db.discountCoupon.update({ where: { id: rewards[0].coupon.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  const refund = await db.paymentRefund.create({ data: { paymentId: f.payment.id, idempotencyKey: `referral-lifecycle-${randomUUID()}`, amount: new Prisma.Decimal("10.00"), currency: f.payment.currency, reason: "CUSTOMER_REQUEST", status: "PENDING" } });
  refundIds.push(refund.id);
  await syncReferralRewardLifecycleForPayment(f.payment.id, `refund:${refund.id}:PENDING`, `REFUND_PENDING:${refund.id}`);
  let coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.ok(coupons.every((coupon) => coupon.status === "INACTIVE"));
  assert.equal(await db.referralRewardLifecycleEvent.count({ where: { referralRewardId: { in: rewards.map((reward) => reward.id) }, eventType: "REWARD_DEACTIVATED" } }), 2);
  await db.paymentRefund.update({ where: { id: refund.id }, data: { status: "FAILED", completedAt: new Date(), failureCode: "TEST_REFUND_FAILED" } });
  await syncReferralRewardLifecycleForPayment(f.payment.id, `refund:${refund.id}:FAILED`, `REFUND_FAILED:${refund.id}`);
  coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.deepEqual(coupons.map((coupon) => coupon.status).sort(), ["ACTIVE", "INACTIVE"]);
  assert.equal(await db.referralRewardLifecycleEvent.count({ where: { referralRewardId: { in: rewards.map((reward) => reward.id) }, eventType: "REWARD_REACTIVATED" } }), 1);
});
test("approved cancellation deactivates unused referral coupons and rejection restores unexpired coupons", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-cancel.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({ data: { referrerCustomerId: referrer.id, invitedCustomerId: f.customer.id, referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`, status: "AWAITING_ORDER" } });
  referralIds.push(referral.id);
  const result = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(result.id);
  const cancellation = await db.cancellationRequest.create({ data: { cancellationReference: `CAN-${randomUUID().replaceAll("-", "").slice(0, 24)}`, customerId: f.customer.id, orderId: result.id, status: "APPROVED", reason: "customer_request" } });
  cancellationIds.push(cancellation.id);
  await syncReferralRewardLifecycleForPayment(f.payment.id, `cancellation:${cancellation.id}:APPROVED`, `CANCELLATION_ACTIVE:${cancellation.id}:APPROVED`);
  let coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.ok(coupons.every((coupon) => coupon.status === "INACTIVE"));
  await db.cancellationRequest.update({ where: { id: cancellation.id }, data: { status: "REJECTED" } });
  await syncReferralRewardLifecycleForPayment(f.payment.id, `cancellation:${cancellation.id}:REJECTED`, `CANCELLATION_REJECTED:${cancellation.id}:REJECTED`);
  coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.ok(coupons.every((coupon) => coupon.status === "ACTIVE"));
  const rewardIds = (await db.referralReward.findMany({ where: { referralId: referral.id }, select: { id: true } })).map((reward) => reward.id);
  assert.equal(await db.referralRewardLifecycleEvent.count({ where: { referralRewardId: { in: rewardIds }, eventType: "REWARD_REACTIVATED" } }), 2);
});
test("rejects a missing or non-successful Payment", async () => {
  const f = await fixture({ status: "FAILED" });
  const app = appFor(f.customer.id);
  await expectCode(() => app.createOrderFromVerifiedPayment({ paymentId: randomUUID() }), "PAYMENT_NOT_FOUND");
  await expectCode(() => app.createOrderFromVerifiedPayment({ paymentId: f.payment.id }), "PAYMENT_NOT_VERIFIED");
});

test("does not disclose or convert another customer's Payment", async () => {
  const f = await fixture();
  const other = await db.customer.create({
    data: { email: `${randomUUID()}@order-creation.invalid` },
  });
  customers.push(other.id);

  await expectCode(
    () => appFor(other.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id }),
    "PAYMENT_NOT_FOUND",
  );
  assert.equal(await db.order.count({ where: { paymentId: f.payment.id } }), 0);
});

test("rejects Payment amount and currency mismatches", async () => {
  const amount = await fixture({ amount: "500.00" });
  await expectCode(
    () => appFor(amount.customer.id).createOrderFromVerifiedPayment({ paymentId: amount.payment.id }),
    "AMOUNT_MISMATCH",
  );

  const currency = await fixture({ currency: "USD" });
  await db.payment.update({
    where: { id: currency.payment.id },
    data: { currency: "INR" },
  });
  await expectCode(
    () => appFor(currency.customer.id).createOrderFromVerifiedPayment({ paymentId: currency.payment.id }),
    "CURRENCY_MISMATCH",
  );
});

test("rejects a stale Checkout when the Cart changes", async () => {
  const f = await fixture();
  await db.cartItem.update({ where: { id: f.cart.items[0].id }, data: { quantity: 2 } });
  await expectCode(
    () => appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id }),
    "CHECKOUT_INVALID",
  );
});

test("rejects an invalid ProductVariant and an invalid quantity", async () => {
  const variant = await fixture();
  await db.productVariant.update({ where: { id: variant.variant.id }, data: { status: "INACTIVE" } });
  await expectCode(
    () => appFor(variant.customer.id).createOrderFromVerifiedPayment({ paymentId: variant.payment.id }),
    "INVALID_ORDER_ITEM",
  );

  const quantity = await fixture();
  await db.cartItem.update({ where: { id: quantity.cart.items[0].id }, data: { quantity: 11 } });
  await expectCode(
    () => appFor(quantity.customer.id).createOrderFromVerifiedPayment({ paymentId: quantity.payment.id }),
    "INVALID_ORDER_ITEM",
  );
});

test("rejects address tampering because Checkout binds the selected address", async () => {
  const f = await fixture();
  await db.customerAddress.delete({ where: { id: f.address.id } });
  await db.customerAddress.create({
    data: {
      customerId: f.customer.id,
      recipientName: "Replacement",
      addressLine1: "2 Other Street",
      city: "Jaipur",
      stateOrProvince: "Rajasthan",
      postalCode: "302002",
      countryCode: "IN",
      label: "Other",
      isDefault: true,
    },
  });

  await expectCode(
    () => appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id }),
    "CHECKOUT_INVALID",
  );
});

test("conversion is idempotent and does not duplicate OrderItems", async () => {
  const f = await fixture();
  const app = appFor(f.customer.id);
  const first = await app.createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(first.id);
  const second = await app.createOrderFromVerifiedPayment({ paymentId: f.payment.id });

  assert.equal(second.id, first.id);
  assert.equal(await db.order.count({ where: { paymentId: f.payment.id } }), 1);
  assert.equal(await db.orderItem.count({ where: { orderId: first.id } }), 1);
});

test("concurrent conversion produces exactly one Order and one item set", async () => {
  const f = await fixture();
  const app = appFor(f.customer.id);
  const [a, b] = await Promise.all([
    app.createOrderFromVerifiedPayment({ paymentId: f.payment.id }),
    app.createOrderFromVerifiedPayment({ paymentId: f.payment.id }),
  ]);
  orders.push(a.id);

  assert.equal(a.id, b.id);
  assert.equal(await db.order.count({ where: { paymentId: f.payment.id } }), 1);
  assert.equal(await db.orderItem.count({ where: { orderId: a.id } }), 1);
});

test("catalog and address mutations after creation do not alter historical snapshots", async () => {
  const f = await fixture();
  const result = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(result.id);

  await db.product.update({ where: { id: f.product.id }, data: { title: "Changed Product" } });
  await db.productVariant.update({ where: { id: f.variant.id }, data: { sku: "CHANGED-SKU", displayName: "Changed Variant" } });
  await db.customerAddress.update({ where: { id: f.address.id }, data: { addressLine1: "Changed Address" } });

  const order = await db.order.findUniqueOrThrow({
    where: { id: result.id },
    include: { items: true, shippingAddress: true },
  });
  assert.equal(order.items[0].productTitleSnapshot, "Order Creation Tee");
  assert.equal(order.items[0].skuSnapshot, f.variant.sku);
  assert.equal(order.shippingAddress?.addressLine1, "1 Test Street");
});

test("browser-side commercial values are not part of the creation contract", async () => {
  const f = await fixture();
  const input = { paymentId: f.payment.id } as Record<string, unknown>;
  assert.deepEqual(Object.keys(input), ["paymentId"]);
  assert.equal("customerId" in input, false);
  assert.equal("checkoutId" in input, false);
  assert.equal("addressId" in input, false);
  assert.equal("amount" in input, false);
  assert.equal("currency" in input, false);
  assert.equal("total" in input, false);
  assert.equal("status" in input, false);
});

test("ambiguous and successful partial refunds suppress the initial 25% reward", async () => {
  for (const refundStatus of ["AMBIGUOUS", "SUCCEEDED"] as const) {
    const f = await fixture();
    const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-refund-gate.invalid` } });
    customers.push(referrer.id);
    const referral = await db.referral.create({
      data: {
        referrerCustomerId: referrer.id,
        invitedCustomerId: f.customer.id,
        referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
        status: "AWAITING_ORDER",
      },
    });
    referralIds.push(referral.id);
    const refund = await db.paymentRefund.create({
      data: {
        paymentId: f.payment.id,
        idempotencyKey: `referral-refund-gate-${randomUUID()}`,
        amount: new Prisma.Decimal("10.00"),
        currency: f.payment.currency,
        reason: "CUSTOMER_REQUEST",
        status: refundStatus,
      },
    });
    refundIds.push(refund.id);

    const order = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
    orders.push(order.id);
    assert.equal(await db.referralReward.count({ where: { referralId: referral.id } }), 0, `${refundStatus} refund must suppress rewards`);
    assert.equal((await db.referral.findUniqueOrThrow({ where: { id: referral.id } })).status, "AWAITING_PAYMENT_REVIEW");
  }
});

test("concurrent refund lifecycle synchronization retries serialization conflicts without duplicate audit events", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-refund-concurrency.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({
    data: {
      referrerCustomerId: referrer.id,
      invitedCustomerId: f.customer.id,
      referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      status: "AWAITING_ORDER",
    },
  });
  referralIds.push(referral.id);
  const order = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(order.id);
  const refund = await db.paymentRefund.create({
    data: {
      paymentId: f.payment.id,
      idempotencyKey: `referral-refund-concurrency-${randomUUID()}`,
      amount: new Prisma.Decimal("10.00"),
      currency: f.payment.currency,
      reason: "CUSTOMER_REQUEST",
      status: "PENDING",
    },
  });
  refundIds.push(refund.id);

  const eventKey = `refund:${refund.id}:PENDING`;
  await Promise.all([
    syncReferralRewardLifecycleForPayment(f.payment.id, eventKey, `REFUND_PENDING:${refund.id}`),
    syncReferralRewardLifecycleForPayment(f.payment.id, eventKey, `REFUND_PENDING:${refund.id}`),
  ]);

  const coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.equal(coupons.length, 2);
  assert.ok(coupons.every((coupon) => coupon.status === "INACTIVE"));
  const rewardIds = (await db.referralReward.findMany({ where: { referralId: referral.id }, select: { id: true } })).map((reward) => reward.id);
  assert.equal(
    await db.referralRewardLifecycleEvent.count({
      where: { referralRewardId: { in: rewardIds }, eventKey: { startsWith: eventKey } },
    }),
    2,
  );
});

test("lifecycle transaction failure rolls back coupon deactivation and audit writes", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-failure-injection.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({
    data: {
      referrerCustomerId: referrer.id,
      invitedCustomerId: f.customer.id,
      referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      status: "AWAITING_ORDER",
    },
  });
  referralIds.push(referral.id);
  const order = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(order.id);
  const rewards = await db.referralReward.findMany({ where: { referralId: referral.id } });
  const refund = await db.paymentRefund.create({
    data: {
      paymentId: f.payment.id,
      idempotencyKey: `referral-failure-injection-${randomUUID()}`,
      amount: new Prisma.Decimal("10.00"),
      currency: f.payment.currency,
      reason: "CUSTOMER_REQUEST",
      status: "PENDING",
    },
  });
  refundIds.push(refund.id);

  // Force the lifecycle audit insert to violate the database's eventKey length constraint
  // after the coupon update has been attempted. The enclosing transaction must roll back.
  await assert.rejects(
    () => syncReferralRewardLifecycleForPayment(f.payment.id, "x".repeat(250), `REFUND_PENDING:${refund.id}`),
  );

  const coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.equal(coupons.length, 2);
  assert.ok(coupons.every((coupon) => coupon.status === "ACTIVE"));
  assert.equal(
    await db.referralRewardLifecycleEvent.count({ where: { referralRewardId: { in: rewards.map((reward) => reward.id) } } }),
    0,
  );
});

test("reserved referral checkout remains valid while future coupon use is disabled and safely restores after failed refund", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-reserved.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({
    data: {
      referrerCustomerId: referrer.id,
      invitedCustomerId: f.customer.id,
      referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      status: "AWAITING_ORDER",
    },
  });
  referralIds.push(referral.id);
  const order = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(order.id);
  const reward = await db.referralReward.findFirstOrThrow({
    where: { referralId: referral.id, recipientCustomerId: f.customer.id },
    include: { coupon: true },
  });
  const checkoutReference = `reserved-referral-${randomUUID()}`;
  const redemption = await db.couponRedemption.create({
    data: {
      couponId: reward.couponId,
      checkoutReference,
      customerId: f.customer.id,
      couponCodeSnapshot: reward.coupon.code,
      discountPercentSnapshot: 25,
      status: "RESERVED",
      eligibleTotal: new Prisma.Decimal("499.00"),
      discountTotal: new Prisma.Decimal("124.75"),
      currency: "INR",
      reservationExpiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  couponRedemptionIds.push(redemption.id);
  const refund = await db.paymentRefund.create({
    data: {
      paymentId: f.payment.id,
      idempotencyKey: `referral-reserved-refund-${randomUUID()}`,
      amount: new Prisma.Decimal("10.00"),
      currency: f.payment.currency,
      reason: "CUSTOMER_REQUEST",
      status: "PENDING",
    },
  });
  refundIds.push(refund.id);

  await syncReferralRewardLifecycleForPayment(f.payment.id, `refund:${refund.id}:PENDING`, `REFUND_PENDING:${refund.id}`);
  assert.equal((await db.discountCoupon.findUniqueOrThrow({ where: { id: reward.couponId } })).status, "INACTIVE");
  assert.equal((await db.couponRedemption.findUniqueOrThrow({ where: { id: redemption.id } })).status, "RESERVED");

  await db.paymentRefund.update({ where: { id: refund.id }, data: { status: "FAILED", completedAt: new Date(), failureCode: "TEST_REFUND_FAILED" } });
  await syncReferralRewardLifecycleForPayment(f.payment.id, `refund:${refund.id}:FAILED`, `REFUND_FAILED:${refund.id}`);
  assert.equal((await db.discountCoupon.findUniqueOrThrow({ where: { id: reward.couponId } })).status, "ACTIVE");
  assert.equal((await db.couponRedemption.findUniqueOrThrow({ where: { id: redemption.id } })).status, "RESERVED");
});

test("concurrent refund and cancellation resolution restores coupons only after both blockers clear", async () => {
  const f = await fixture();
  const referrer = await db.customer.create({ data: { email: `${randomUUID()}@referral-dual-lifecycle.invalid` } });
  customers.push(referrer.id);
  const referral = await db.referral.create({
    data: {
      referrerCustomerId: referrer.id,
      invitedCustomerId: f.customer.id,
      referralCodeSnapshot: `TEST-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      status: "AWAITING_ORDER",
    },
  });
  referralIds.push(referral.id);
  const order = await appFor(f.customer.id).createOrderFromVerifiedPayment({ paymentId: f.payment.id });
  orders.push(order.id);
  const refund = await db.paymentRefund.create({
    data: {
      paymentId: f.payment.id,
      idempotencyKey: `referral-dual-refund-${randomUUID()}`,
      amount: new Prisma.Decimal("10.00"),
      currency: f.payment.currency,
      reason: "CUSTOMER_REQUEST",
      status: "PENDING",
    },
  });
  refundIds.push(refund.id);
  const cancellation = await db.cancellationRequest.create({
    data: {
      cancellationReference: `CAN-${randomUUID().replaceAll("-", "").slice(0, 24)}`,
      customerId: f.customer.id,
      orderId: order.id,
      status: "APPROVED",
      reason: "customer_request",
    },
  });
  cancellationIds.push(cancellation.id);

  await Promise.all([
    syncReferralRewardLifecycleForPayment(f.payment.id, `refund:${refund.id}:PENDING`, `REFUND_PENDING:${refund.id}`),
    syncReferralRewardLifecycleForPayment(f.payment.id, `cancellation:${cancellation.id}:APPROVED`, `CANCELLATION_ACTIVE:${cancellation.id}:APPROVED`),
  ]);
  let coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.ok(coupons.every((coupon) => coupon.status === "INACTIVE"));

  await Promise.all([
    db.paymentRefund.update({ where: { id: refund.id }, data: { status: "FAILED", completedAt: new Date(), failureCode: "TEST_REFUND_FAILED" } }),
    db.cancellationRequest.update({ where: { id: cancellation.id }, data: { status: "REJECTED" } }),
  ]);
  await Promise.all([
    syncReferralRewardLifecycleForPayment(f.payment.id, `refund:${refund.id}:FAILED`, `REFUND_FAILED:${refund.id}`),
    syncReferralRewardLifecycleForPayment(f.payment.id, `cancellation:${cancellation.id}:REJECTED`, `CANCELLATION_REJECTED:${cancellation.id}`),
  ]);
  await syncReferralRewardLifecycleForPayment(f.payment.id, `lifecycle:${referral.id}:settled`, `REFUND_FAILED:${refund.id}`);

  coupons = await db.discountCoupon.findMany({ where: { referralId: referral.id } });
  assert.ok(coupons.every((coupon) => coupon.status === "ACTIVE"));
  const rewardIds = (await db.referralReward.findMany({ where: { referralId: referral.id }, select: { id: true } })).map((reward) => reward.id);
  assert.equal(
    await db.referralRewardLifecycleEvent.count({ where: { referralRewardId: { in: rewardIds }, eventType: "REWARD_REACTIVATED" } }),
    2,
  );
});

after(async () => {
  if (couponRedemptionIds.length) await db.couponRedemption.deleteMany({ where: { id: { in: couponRedemptionIds } } });
  if (referralIds.length) {
    const rewardIds = (await db.referralReward.findMany({ where: { referralId: { in: referralIds } }, select: { id: true } })).map((reward) => reward.id);
    if (rewardIds.length) await db.referralRewardLifecycleEvent.deleteMany({ where: { referralRewardId: { in: rewardIds } } });
    await db.referralReward.deleteMany({ where: { referralId: { in: referralIds } } });
    await db.discountCoupon.deleteMany({ where: { referralId: { in: referralIds } } });
    await db.referral.deleteMany({ where: { id: { in: referralIds } } });
  }
  await db.notificationDelivery.deleteMany({ where: { customerId: { in: customers } } });
  await db.notificationEvent.deleteMany({ where: { customerId: { in: customers } } });
  if (cancellationIds.length) await db.cancellationRequest.deleteMany({ where: { id: { in: cancellationIds } } });
  if (orders.length) await db.order.deleteMany({ where: { id: { in: orders } } });
  if (cartItems.length) await db.cartItem.deleteMany({ where: { id: { in: cartItems } } });
  if (carts.length) await db.cart.deleteMany({ where: { id: { in: carts } } });
  if (addresses.length) await db.customerAddress.deleteMany({ where: { id: { in: addresses } } });
  if (refundIds.length) await db.paymentRefund.deleteMany({ where: { id: { in: refundIds } } });
  if (payments.length) await db.payment.deleteMany({ where: { id: { in: payments } } });
  if (inventories.length) await db.inventory.deleteMany({ where: { id: { in: inventories } } });
  if (variants.length) await db.productVariant.deleteMany({ where: { id: { in: variants } } });
  if (products.length) await db.product.deleteMany({ where: { id: { in: products } } });
  if (customers.length) await db.customer.deleteMany({ where: { id: { in: customers } } });
  await db.$disconnect();
});
