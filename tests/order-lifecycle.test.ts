import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createOrderApplication } from "@/lib/orders/application";
import { OrderDomainError } from "@/lib/orders/errors";

const customers: string[] = [];
const payments: string[] = [];
const orders: string[] = [];

async function fixture(status: "SUCCEEDED" | "FAILED" = "SUCCEEDED") {
  const customer = await db.customer.create({
    data: { email: `${randomUUID()}@order-lifecycle.invalid` },
  });
  customers.push(customer.id);

  const payment = await db.payment.create({
    data: {
      customerId: customer.id,
      checkoutReference: `checkout-${randomUUID()}`,
      internalReference: `pay-${randomUUID()}`,
      status,
      amount: new Prisma.Decimal("499.00"),
      currency: "INR",
      completedAt: status === "SUCCEEDED" ? new Date() : null,
    },
  });
  payments.push(payment.id);

  const order = await db.order.create({
    data: {
      customerId: customer.id,
      checkoutReference: payment.checkoutReference,
      paymentId: payment.id,
      orderNumber: `ORD-${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`,
      status: "PENDING",
      subtotal: new Prisma.Decimal("499.00"),
      total: new Prisma.Decimal("499.00"),
      currency: "INR",
      items: {
        create: {
          productTitleSnapshot: "Lifecycle Tee",
          variantTitleSnapshot: "Black / M",
          skuSnapshot: "LIFE-M",
          quantity: 1,
          unitPrice: new Prisma.Decimal("499.00"),
          lineTotal: new Prisma.Decimal("499.00"),
          currency: "INR",
        },
      },
    },
  });
  orders.push(order.id);

  return { customer, payment, order };
}

function appFor(customerId: string) {
  return createOrderApplication({ resolveCustomer: async () => ({ id: customerId }) });
}

async function expectCode(work: () => Promise<unknown>, code: OrderDomainError["code"]) {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof OrderDomainError);
    assert.equal(error.code, code);
    return true;
  });
}

test("valid PENDING -> CONFIRMED transition succeeds only after verified payment", async () => {
  const f = await fixture();
  const result = await appFor(f.customer.id).transitionOrderLifecycle({
    orderId: f.order.id,
    expectedStatus: "PENDING",
    nextStatus: "CONFIRMED",
  });
  assert.equal(result.status, "CONFIRMED");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "CONFIRMED");
});

test("invalid transition is rejected and CONFIRMED cannot regress", async () => {
  const f = await fixture();
  await db.order.update({ where: { id: f.order.id }, data: { status: "CONFIRMED" } });
  await expectCode(
    () => appFor(f.customer.id).transitionOrderLifecycle({
      orderId: f.order.id,
      expectedStatus: "CONFIRMED",
      nextStatus: "PENDING",
    }),
    "ORDER_TERMINAL",
  );
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "CONFIRMED");
});

test("transition rejects an ineligible Payment", async () => {
  const f = await fixture("FAILED");
  await expectCode(
    () => appFor(f.customer.id).transitionOrderLifecycle({
      orderId: f.order.id,
      expectedStatus: "PENDING",
      nextStatus: "CONFIRMED",
    }),
    "ORDER_PAYMENT_NOT_ELIGIBLE",
  );
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "PENDING");
});

test("wrong expected state cannot overwrite the current lifecycle state", async () => {
  const f = await fixture();
  await db.order.update({ where: { id: f.order.id }, data: { status: "CONFIRMED" } });
  await expectCode(
    () => appFor(f.customer.id).transitionOrderLifecycle({
      orderId: f.order.id,
      expectedStatus: "PENDING",
      nextStatus: "CONFIRMED",
    }),
    "ORDER_CONCURRENCY_CONFLICT",
  );
});

test("concurrent PENDING -> CONFIRMED transitions cannot both mutate the Order", async () => {
  const f = await fixture();
  const app = appFor(f.customer.id);
  const results = await Promise.allSettled([
    app.transitionOrderLifecycle({ orderId: f.order.id, expectedStatus: "PENDING", nextStatus: "CONFIRMED" }),
    app.transitionOrderLifecycle({ orderId: f.order.id, expectedStatus: "PENDING", nextStatus: "CONFIRMED" }),
  ]);

  const successes = results.filter((result) => result.status === "fulfilled");
  const failures = results.filter((result) => result.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  const failure = failures[0];
  assert.equal(failure.status, "rejected");
  assert.ok(failure.reason instanceof OrderDomainError);
  assert.equal(failure.reason.code, "ORDER_CONCURRENCY_CONFLICT");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, "CONFIRMED");
});

test("lifecycle transition does not mutate historical Order data", async () => {
  const f = await fixture();
  const before = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { items: true },
  });
  await appFor(f.customer.id).transitionOrderLifecycle({
    orderId: f.order.id,
    expectedStatus: "PENDING",
    nextStatus: "CONFIRMED",
  });
  const afterOrder = await db.order.findUniqueOrThrow({
    where: { id: f.order.id },
    include: { items: true },
  });
  assert.equal(afterOrder.orderNumber, before.orderNumber);
  assert.equal(afterOrder.total.toFixed(2), before.total.toFixed(2));
  assert.equal(afterOrder.items[0].productTitleSnapshot, before.items[0].productTitleSnapshot);
  assert.equal(afterOrder.items[0].unitPrice.toFixed(2), before.items[0].unitPrice.toFixed(2));
});

after(async () => {
  if (orders.length) await db.order.deleteMany({ where: { id: { in: orders } } });
  if (payments.length) await db.payment.deleteMany({ where: { id: { in: payments } } });
  if (customers.length) await db.customer.deleteMany({ where: { id: { in: customers } } });
  await db.$disconnect();
});
