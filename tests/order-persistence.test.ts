import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createOrderRepository } from "@/lib/orders/repository";

const repository = createOrderRepository();

const customerIds: string[] = [];
const paymentIds: string[] = [];
const productIds: string[] = [];
const orderIds: string[] = [];

async function customer() {
  const record = await db.customer.create({
    data: {
      email: `${randomUUID()}@order-tests.invalid`,
      displayName: "Order Test Customer",
    },
  });
  customerIds.push(record.id);
  return record;
}

async function payment(customerId: string, checkoutReference: string, amount = "499.00") {
  const record = await db.payment.create({
    data: {
      customerId,
      checkoutReference,
      internalReference: `pay-${randomUUID()}`,
      status: "SUCCEEDED",
      amount: new Prisma.Decimal(amount),
      currency: "INR",
      completedAt: new Date(),
    },
  });
  paymentIds.push(record.id);
  return record;
}

async function orderInput(customerId: string, checkoutReference: string, paymentId: string) {
  return {
    customerId,
    checkoutReference,
    paymentId,
    subtotal: "499.00",
    total: "499.00",
    currency: "INR",
  };
}

test("Order persistence creates an immutable commercial record with item and address snapshots", async () => {
  const c = await customer();
  const p = await payment(c.id, `checkout-${randomUUID()}`);
  const order = await repository.createOrderWithItems({
    ...(await orderInput(c.id, p.checkoutReference, p.id)),
    items: [{
      productTitleSnapshot: "Original Tee",
      variantTitleSnapshot: "Black / M",
      skuSnapshot: "TEE-BLK-M",
      selectedOptionsSnapshot: { color: "Black", size: "M" },
      quantity: 2,
      unitPrice: "249.50",
      lineTotal: "499.00",
      currency: "INR",
    }],
    shippingAddress: {
      recipientName: "Order Test Customer",
      phone: "9999999999",
      addressLine1: "1 Test Street",
      addressLine2: null,
      city: "Jaipur",
      stateOrProvince: "Rajasthan",
      postalCode: "302001",
      countryCode: "IN",
      label: "Home",
    },
  });
  orderIds.push(order.id);

  assert.equal(order.status, "PENDING");
  assert.equal(order.currency, "INR");
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productTitleSnapshot, "Original Tee");
  assert.equal(order.items[0].unitPrice.toFixed(2), "249.50");
  assert.equal(order.shippingAddress?.addressLine1, "1 Test Street");
});

test("Order Number is server-generated and unique", async () => {
  const c = await customer();
  const p = await payment(c.id, `checkout-${randomUUID()}`);
  const order = await repository.createOrder(await orderInput(c.id, p.checkoutReference, p.id));
  orderIds.push(order.id);

  assert.match(order.orderNumber, /^ORD-[A-F0-9]{24}$/);
  assert.notEqual(order.orderNumber, order.id);
});

test("Checkout and Payment references each allow only one Order", async () => {
  const c = await customer();
  const checkoutReference = `checkout-${randomUUID()}`;
  const p = await payment(c.id, checkoutReference);
  const first = await repository.createOrder(await orderInput(c.id, checkoutReference, p.id));
  orderIds.push(first.id);

  await assert.rejects(() => repository.createOrder({
    customerId: c.id,
    checkoutReference,
    paymentId: p.id,
    subtotal: "499.00",
    total: "499.00",
    currency: "INR",
  }));
});

test("Customer-scoped lookup prevents cross-customer Order access", async () => {
  const owner = await customer();
  const other = await customer();
  const p = await payment(owner.id, `checkout-${randomUUID()}`);
  const order = await repository.createOrder(await orderInput(owner.id, p.checkoutReference, p.id));
  orderIds.push(order.id);

  assert.equal((await repository.getOrderByCustomer(order.id, owner.id))?.id, order.id);
  assert.equal(await repository.getOrderByCustomer(order.id, other.id), null);
});

test("Order lookup works by Order Number, Checkout reference, Payment and Customer", async () => {
  const c = await customer();
  const p = await payment(c.id, `checkout-${randomUUID()}`);
  const order = await repository.createOrder(await orderInput(c.id, p.checkoutReference, p.id));
  orderIds.push(order.id);

  assert.equal((await repository.getOrderByNumber(order.orderNumber))?.id, order.id);
  assert.equal((await repository.getOrderByCheckout(p.checkoutReference))?.id, order.id);
  assert.equal((await repository.getOrderByPayment(p.id))?.id, order.id);
  assert.equal((await repository.getOrdersByCustomer(c.id))[0]?.id, order.id);
});

test("Catalog deletion preserves historical OrderItem snapshots", async () => {
  const c = await customer();
  const p = await payment(c.id, `checkout-${randomUUID()}`);
  const product = await db.product.create({
    data: {
      title: "Mutable Catalog Tee",
      slug: `order-test-${randomUUID()}`,
      price: new Prisma.Decimal("249.50"),
      currency: "INR",
      variants: {
        create: {
          sku: `SKU-${randomUUID()}`,
          displayName: "Black / M",
          price: new Prisma.Decimal("249.50"),
        },
      },
    },
    include: { variants: true },
  });
  productIds.push(product.id);

  const order = await repository.createOrderWithItems({
    ...(await orderInput(c.id, p.checkoutReference, p.id)),
    items: [{
      productId: product.id,
      variantId: product.variants[0].id,
      productTitleSnapshot: "Mutable Catalog Tee",
      variantTitleSnapshot: "Black / M",
      skuSnapshot: product.variants[0].sku,
      quantity: 1,
      unitPrice: "499.00",
      lineTotal: "499.00",
      currency: "INR",
    }],
  });
  orderIds.push(order.id);

  await db.product.delete({ where: { id: product.id } });
  const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });

  assert.equal(item.productId, null);
  assert.equal(item.variantId, null);
  assert.equal(item.productTitleSnapshot, "Mutable Catalog Tee");
  assert.equal(item.skuSnapshot, product.variants[0].sku);
});

test("Persistence rejects invalid quantities and monetary values", async () => {
  const c = await customer();
  const p = await payment(c.id, `checkout-${randomUUID()}`);

  await assert.rejects(async () => repository.createOrderWithItems({
    customerId: c.id,
    checkoutReference: p.checkoutReference,
    paymentId: p.id,
    subtotal: "499.00",
    total: "499.00",
    currency: "INR",
    items: [{
      productTitleSnapshot: "Invalid Quantity",
      quantity: 0,
      unitPrice: "499.00",
      lineTotal: "499.00",
      currency: "INR",
    }],
  }));

  await assert.rejects(async () => repository.createOrder({
    customerId: c.id,
    checkoutReference: `checkout-${randomUUID()}`,
    paymentId: p.id,
    subtotal: "-1.00",
    total: "499.00",
    currency: "INR",
  }));
});

after(async () => {
  if (orderIds.length) {
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (productIds.length) {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
  }
  if (paymentIds.length) {
    await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
  }
  if (customerIds.length) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  }
  await db.$disconnect();
});
