import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createShippingRepository } from "@/lib/shipping/repository";

const repository = createShippingRepository();
const customerIds: string[] = [];
const paymentIds: string[] = [];
const orderIds: string[] = [];
const fulfillmentIds: string[] = [];
const shipmentIds: string[] = [];

async function fixture() {
  const customer = await db.customer.create({
    data: { email: `${randomUUID()}@shipping-tests.invalid`, displayName: "Shipping Test Customer" },
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
          recipientName: "Shipping Test Customer",
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
      idempotencyKey: `fulfillment-${randomUUID()}`,
      status: "SUBMITTED",
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

test("Shipment persistence enforces Fulfillment and Order consistency", async () => {
  const { customer, order, fulfillment } = await fixture();

  const shipment = await repository.createShipment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
    providerId: "qikink",
  });
  shipmentIds.push(shipment.id);

  assert.equal(shipment.orderId, order.id);
  assert.equal(shipment.fulfillmentId, fulfillment.id);
  assert.match(shipment.shipmentReference, /^SHP-[0-9A-F]{32}$/);
  assert.equal((await repository.getShipmentByCustomer(shipment.id, customer.id))?.id, shipment.id);

  await assert.rejects(
    () => repository.createShipment({
      orderId: randomUUID(),
      fulfillmentId: fulfillment.id,
        providerId: "qikink",
    }),
    /Shipment Order does not match the Fulfillment Order/,
  );
});

test("TrackingEvent persistence is historical and deduplicated", async () => {
  const { order, fulfillment } = await fixture();
  const shipment = await repository.createShipment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
    providerId: "qikink",
    trackingNumber: "AWB-TEST-1",
    carrier: "Test Carrier",
  });
  shipmentIds.push(shipment.id);

  const occurredAt = new Date("2026-10-02T10:00:00.000Z");
  const first = await repository.createTrackingEvent({
    shipmentId: shipment.id,
    providerId: "qikink",
    providerEventId: "provider-event-1",
    providerStatus: "In-transit",
    normalizedStatus: "IN_TRANSIT",
    eventTimestamp: occurredAt,
    source: "PROVIDER",
  });
  const duplicate = await repository.createTrackingEvent({
    shipmentId: shipment.id,
    providerId: "qikink",
    providerEventId: "provider-event-1",
    providerStatus: "In-transit",
    normalizedStatus: "IN_TRANSIT",
    eventTimestamp: occurredAt,
    source: "PROVIDER",
  });

  assert.equal(duplicate.id, first.id);
  const events = await repository.listTrackingEvents(shipment.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventTimestamp.toISOString(), occurredAt.toISOString());

  const older = await repository.createTrackingEvent({
    shipmentId: shipment.id,
    providerId: "qikink",
    providerEventId: "provider-event-0",
    providerStatus: "Manifested",
    normalizedStatus: "CREATED",
    eventTimestamp: new Date("2026-10-02T09:00:00.000Z"),
    source: "PROVIDER",
  });
  assert.notEqual(older.id, first.id);
  assert.equal((await repository.listTrackingEvents(shipment.id)).length, 2);
});

test("Shipment lifecycle uses controlled transitions", async () => {
  const { order, fulfillment } = await fixture();
  const shipment = await repository.createShipment({
    orderId: order.id,
    fulfillmentId: fulfillment.id,
    providerId: "qikink",
  });
  shipmentIds.push(shipment.id);

  const moved = await repository.transitionStatus({
    id: shipment.id,
    expectedStatus: "CREATED",
    nextStatus: "IN_TRANSIT",
    shippedAt: new Date(),
  });
  assert.equal(moved?.status, "IN_TRANSIT");

  await assert.rejects(
    () => repository.transitionStatus({
      id: shipment.id,
      expectedStatus: "IN_TRANSIT",
      nextStatus: "CREATED",
    }),
    /Invalid Shipment transition/,
  );

  assert.equal(
    await repository.getShipmentByCustomer(shipment.id, randomUUID()),
    null,
  );
});

after(async () => {
  if (shipmentIds.length) await db.trackingEvent.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
  if (shipmentIds.length) await db.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
  if (fulfillmentIds.length) await db.fulfillment.deleteMany({ where: { id: { in: fulfillmentIds } } });
  if (orderIds.length) await db.order.deleteMany({ where: { id: { in: orderIds } } });
  if (paymentIds.length) await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
  if (customerIds.length) await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  await db.$disconnect();
});
