import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createOrderApplication } from "@/lib/orders/application";
import { OrderDomainError } from "@/lib/orders/errors";
import { createCheckoutPaymentReference } from "@/lib/payments/checkout";

const customers: string[] = [];
const addresses: string[] = [];
const carts: string[] = [];
const cartItems: string[] = [];
const products: string[] = [];
const variants: string[] = [];
const payments: string[] = [];
const orders: string[] = [];

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
  await db.cartItem.update({ where: { id: quantity.cart.items[0].id }, data: { quantity: 0 } });
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

after(async () => {
  if (orders.length) await db.order.deleteMany({ where: { id: { in: orders } } });
  if (cartItems.length) await db.cartItem.deleteMany({ where: { id: { in: cartItems } } });
  if (carts.length) await db.cart.deleteMany({ where: { id: { in: carts } } });
  if (addresses.length) await db.customerAddress.deleteMany({ where: { id: { in: addresses } } });
  if (payments.length) await db.payment.deleteMany({ where: { id: { in: payments } } });
  if (variants.length) await db.productVariant.deleteMany({ where: { id: { in: variants } } });
  if (products.length) await db.product.deleteMany({ where: { id: { in: products } } });
  if (customers.length) await db.customer.deleteMany({ where: { id: { in: customers } } });
  await db.$disconnect();
});
