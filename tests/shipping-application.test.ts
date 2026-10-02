import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createShippingApplication } from "@/lib/shipping/application";
import { ShippingDomainError } from "@/lib/shipping/errors";

const customerIds: string[] = [];
const paymentIds: string[] = [];
const orderIds: string[] = [];
const fulfillmentIds: string[] = [];
const shipmentIds: string[] = [];

async function fixture(status: "SUBMITTED" | "PENDING" = "SUBMITTED", providerReference = `QIK-${randomUUID()}`) {
  const customer = await db.customer.create({
    data: { email: `${randomUUID()}@shipping-domain.invalid`, displayName: "Shipping Domain Test" },
  });
  customerIds.push(customer.id);

  const payment = await db.payment.create({
    data: {
      customerId: customer.id,
      checkoutReference: `checkout-${randomUUID()}`,
      internalReference: `pay-${randomUUID()}`,
      status: "SUCCEEDED",
      amount: new Prisma.Decimal("499.00"),
      currency: "INR",
      completedAt: new Date(),
    },
  });
  paymentIds.push(payment.id);

  const order = await db.order.create({
    data: {
      customerId: customer.id,
      checkoutReference: payment.checkoutReference,
      paymentId: payment.id,
      orderNumber: `ORD-${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`,
      status: "CONFIRMED",
      subtotal: new Prisma.Decimal("499.00"),
      total: new Prisma.Decimal("499.00"),
      currency: "INR",
      shippingAddress: {
        create: {
          recipientName: "Shipping Domain Test",
          phone: "9999999999",
          addressLine1: "1 Test Street",
          addressLine2: null,
          city: "Jaipur",
          stateOrProvince: "Rajasthan",
          postalCode: "302001",
          countryCode: "IN",
          label: "Home",
        },
      },
      items: {
        create: {
          productTitleSnapshot: "Test Tee",
          variantTitleSnapshot: "Black / M",
          skuSnapshot: "TEST-TEE-BLK-M",
          quantity: 1,
          unitPrice: new Prisma.Decimal("499.00"),
          lineTotal: new Prisma.Decimal("499.00"),
          currency: "INR",
        },
      },
    },
  });
  orderIds.push(order.id);

  const fulfillment = await db.fulfillment.create({
    data: {
      orderId: order.id,
      provider: "qikink",
      providerFulfillmentReference: providerReference,
      idempotencyKey: `fulfillment-${randomUUID()}`,
      status,
      items: {
        create: {
          orderItemId: (await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).id,
          quantity: 1,
          providerSku: "QIK-TEST-SKU",
        },
      },
    },
  });
  fulfillmentIds.push(fulfillment.id);
  return { customer, order, fulfillment };
}

test("Fulfillment -> Shipment handoff requires submitted fulfillment and trusted provider reference", async () => {
  const { order, fulfillment } = await fixture("SUBMITTED");
  const app = createShippingApplication();

  const shipment = await app.createShipmentFromFulfillment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  });
  assert.ok(shipment);
  if (shipment) shipmentIds.push(shipment.id);
  assert.equal(shipment?.fulfillmentId, fulfillment.id);
  assert.equal(shipment?.providerReference, fulfillment.providerFulfillmentReference);
  assert.equal(shipment?.status, "CREATED");

  const repeated = await app.createShipmentFromFulfillment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  });
  assert.equal(repeated?.id, shipment?.id);
});

test("Shipment handoff rejects non-eligible Fulfillment", async () => {
  const { order, fulfillment } = await fixture("PENDING");
  const app = createShippingApplication();

  await assert.rejects(
    () => app.createShipmentFromFulfillment({
      orderId: order.id,
      fulfillmentId: fulfillment.id,
    }),
    (error: unknown) => error instanceof ShippingDomainError
      && error.code === "FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT",
  );
});

test("Concurrent Shipment handoff remains idempotent", async () => {
  const { order, fulfillment } = await fixture("SUBMITTED");
  const app = createShippingApplication();
  const key = `handoff-${fulfillment.id}`;

  const results = await Promise.all([
    app.createShipmentFromFulfillment({ orderId: order.id, fulfillmentId: fulfillment.id, idempotencyKey: key }),
    app.createShipmentFromFulfillment({ orderId: order.id, fulfillmentId: fulfillment.id, idempotencyKey: key }),
  ]);

  assert.equal(results[0]?.id, results[1]?.id);
  if (results[0]) shipmentIds.push(results[0].id);
});

test("Tracking processor prevents terminal regression and preserves out-of-order history", async () => {
  const { customer, order, fulfillment } = await fixture("SUBMITTED");
  const app = createShippingApplication();
  const shipment = await app.createShipmentFromFulfillment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  });
  assert.ok(shipment);
  if (!shipment) return;
  shipmentIds.push(shipment.id);

  const delivered = await app.processNormalizedTrackingEvent({
    shipmentId: shipment.id,
    event: {
      providerId: "qikink",
      providerEventId: "evt-delivered",
      providerStatus: "Delivered",
      normalizedStatus: "DELIVERED",
      eventTimestamp: new Date("2026-10-02T12:00:00.000Z"),
      location: "Jaipur",
      description: "Delivered",
    },
  });
  assert.equal(delivered?.status, "DELIVERED");
  assert.equal(delivered?.deliveredAt?.toISOString(), "2026-10-02T12:00:00.000Z");

  const late = await app.processNormalizedTrackingEvent({
    shipmentId: shipment.id,
    event: {
      providerId: "qikink",
      providerEventId: "evt-in-transit",
      providerStatus: "In-transit",
      normalizedStatus: "IN_TRANSIT",
      eventTimestamp: new Date("2026-10-02T11:00:00.000Z"),
      location: "Jaipur",
      description: "In transit",
    },
  });
  assert.equal(late?.status, "DELIVERED");

  const customerShipment = await app.getCustomerShipment({
    shipmentId: shipment.id,
    customerId: customer.id,
  });
  assert.equal(customerShipment?.status, "DELIVERED");
  assert.equal(customerShipment?.events.length, 2);
  assert.equal(customerShipment?.events[0]?.occurredAt, "2026-10-02T11:00:00.000Z");
  assert.equal(customerShipment?.events[1]?.occurredAt, "2026-10-02T12:00:00.000Z");
});

test("Duplicate provider tracking event is idempotent", async () => {
  const { order, fulfillment } = await fixture("SUBMITTED");
  const app = createShippingApplication();
  const shipment = await app.createShipmentFromFulfillment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  });
  assert.ok(shipment);
  if (!shipment) return;
  shipmentIds.push(shipment.id);

  const event = {
    providerId: "qikink",
    providerEventId: "evt-duplicate",
    providerStatus: "In-transit",
    normalizedStatus: "IN_TRANSIT" as const,
    eventTimestamp: new Date("2026-10-02T12:00:00.000Z"),
    location: "Jaipur",
    description: "In transit",
  };

  const first = await app.processNormalizedTrackingEvent({ shipmentId: shipment.id, event });
  const second = await app.processNormalizedTrackingEvent({ shipmentId: shipment.id, event });
  assert.equal(first?.status, "IN_TRANSIT");
  assert.equal(second?.status, "IN_TRANSIT");

  const stored = await db.trackingEvent.count({ where: { shipmentId: shipment.id } });
  assert.equal(stored, 1);
});

test("Customer ownership prevents IDOR", async () => {
  const { order, fulfillment } = await fixture("SUBMITTED");
  const otherCustomer = await db.customer.create({
    data: { email: `${randomUUID()}@shipping-domain.invalid`, displayName: "Other Customer" },
  });
  customerIds.push(otherCustomer.id);

  const app = createShippingApplication();
  const shipment = await app.createShipmentFromFulfillment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  });
  assert.ok(shipment);
  if (!shipment) return;
  shipmentIds.push(shipment.id);

  assert.equal(
    await app.getCustomerShipment({ shipmentId: shipment.id, customerId: otherCustomer.id }),
    null,
  );
});

test("Qikink reconciliation is bounded by verified capabilities", async () => {
  const { order, fulfillment } = await fixture("SUBMITTED");
  const app = createShippingApplication();
  const shipment = await app.createShipmentFromFulfillment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
  });
  assert.ok(shipment);
  if (!shipment) return;
  shipmentIds.push(shipment.id);

  const result = await app.reconcileShipment({ shipmentId: shipment.id });
  assert.equal(result.status, "PROVIDER_UNSUPPORTED");
});

after(async () => {
  if (shipmentIds.length) await db.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
  if (fulfillmentIds.length) await db.fulfillment.deleteMany({ where: { id: { in: fulfillmentIds } } });
  if (orderIds.length) await db.order.deleteMany({ where: { id: { in: orderIds } } });
  if (paymentIds.length) await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
  if (customerIds.length) await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  await db.$disconnect();
});
