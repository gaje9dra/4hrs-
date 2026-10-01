import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { createOrderApplication } from "@/lib/orders/application";
import { toPublicOrderDto } from "@/lib/orders/dto";
import { OrderDomainError } from "@/lib/orders/errors";
import type { OrderRepository, OrderWithRelations } from "@/lib/orders/repository";

function fakeOrder(customerId = "customer-a"): OrderWithRelations {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerId,
    checkoutReference: "checkout-internal",
    paymentId: "22222222-2222-4222-8222-222222222222",
    orderNumber: "ORD-AAAAAAAAAAAAAAAAAAAAAAAA",
    status: "PENDING",
    subtotal: new Prisma.Decimal("499.00"),
    total: new Prisma.Decimal("499.00"),
    currency: "INR",
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    items: [{
      id: "33333333-3333-4333-8333-333333333333",
      orderId: "11111111-1111-4111-8111-111111111111",
      productId: "44444444-4444-4444-8444-444444444444",
      variantId: "55555555-5555-4555-8555-555555555555",
      productTitleSnapshot: "Snapshot Tee",
      variantTitleSnapshot: "Black / M",
      skuSnapshot: "TEE-M",
      selectedOptionsSnapshot: { size: "M", color: "Black" },
      quantity: 1,
      unitPrice: new Prisma.Decimal("499.00"),
      lineTotal: new Prisma.Decimal("499.00"),
      currency: "INR",
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
    }],
    shippingAddress: {
      id: "66666666-6666-4666-8666-666666666666",
      orderId: "11111111-1111-4111-8111-111111111111",
      recipientName: "Customer",
      phone: "9999999999",
      addressLine1: "1 Test Street",
      addressLine2: null,
      city: "Jaipur",
      stateOrProvince: "Rajasthan",
      postalCode: "302001",
      countryCode: "IN",
      label: "Home",
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
    },
  } as OrderWithRelations;
}

function repository(order: OrderWithRelations | null): OrderRepository {
  const candidate = order;
  return {
    getOrderById: async () => candidate,
    getOrderByNumberForCustomer: async (number: string, customerId: string) =>
      candidate?.orderNumber === number && candidate.customerId === customerId ? candidate : null,
    getOrderByCustomer: async (id: string, customerId: string) =>
      candidate?.id === id && candidate.customerId === customerId ? candidate : null,
    listOrdersByCustomer: async (customerId: string) => ({
      orders: candidate && candidate.customerId === customerId ? [candidate] : [],
      page: 1,
      pageSize: 20,
      total: candidate && candidate.customerId === customerId ? 1 : 0,
      totalPages: 1,
      hasNextPage: false,
    }),
  } as unknown as OrderRepository;
}

test("public Order DTO contains snapshots and excludes internal persistence/payment fields", () => {
  const dto = toPublicOrderDto(fakeOrder());
  assert.equal(dto.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(dto.orderNumber, "ORD-AAAAAAAAAAAAAAAAAAAAAAAA");
  assert.equal(dto.items[0].productTitle, "Snapshot Tee");
  assert.deepEqual(dto.items[0].selectedOptions, { size: "M", color: "Black" });
  assert.equal(dto.address?.addressLine1, "1 Test Street");
  assert.equal("customerId" in dto, false);
  assert.equal("paymentId" in dto, false);
  assert.equal("checkoutReference" in dto, false);
  assert.equal("updatedAt" in dto, false);
});

test("authenticated customer can retrieve their own Order by ID and Order Number", async () => {
  const order = fakeOrder();
  const app = createOrderApplication({
    orderRepository: repository(order),
    resolveCustomer: async () => ({ id: order.customerId }),
  });
  const byId = await app.getCustomerOrder({ identifier: order.id });
  const byNumber = await app.getCustomerOrder({ identifier: order.orderNumber });
  assert.equal(byId.id, order.id);
  assert.equal(byNumber.orderNumber, order.orderNumber);
});

test("another customer cannot retrieve an Order by ID or Order Number", async () => {
  const order = fakeOrder("customer-b");
  const app = createOrderApplication({
    orderRepository: repository(order),
    resolveCustomer: async () => ({ id: "customer-a" }),
  });
  await assert.rejects(
    () => app.getCustomerOrder({ identifier: order.id }),
    (error: unknown) => error instanceof OrderDomainError && error.code === "ORDER_NOT_FOUND",
  );
  await assert.rejects(
    () => app.getCustomerOrder({ identifier: order.orderNumber }),
    (error: unknown) => error instanceof OrderDomainError && error.code === "ORDER_NOT_FOUND",
  );
});

test("unauthenticated retrieval and listing are rejected", async () => {
  const app = createOrderApplication({
    orderRepository: repository(fakeOrder()),
    resolveCustomer: async () => null,
  });
  await assert.rejects(
    () => app.getCustomerOrder({ identifier: fakeOrder().id }),
    (error: unknown) => error instanceof OrderDomainError && error.code === "PAYMENT_ACCESS_DENIED",
  );
  await assert.rejects(
    () => app.listCustomerOrders({ page: 1, pageSize: 20 }),
    (error: unknown) => error instanceof OrderDomainError && error.code === "PAYMENT_ACCESS_DENIED",
  );
});

test("list contract is customer scoped and pagination is bounded", async () => {
  const order = fakeOrder("customer-a");
  const app = createOrderApplication({
    orderRepository: repository(order),
    resolveCustomer: async () => ({ id: "customer-a" }),
  });
  const result = await app.listCustomerOrders({ page: 1, pageSize: 20 });
  assert.equal(result.orders.length, 1);
  assert.equal(result.pagination.pageSize, 20);

  await assert.rejects(
    () => app.listCustomerOrders({ page: 1, pageSize: 51 }),
    (error: unknown) => error instanceof OrderDomainError && error.code === "ORDER_INVALID_REQUEST",
  );
  await assert.rejects(
    () => app.getCustomerOrder({ identifier: "not-an-order-id" }),
    (error: unknown) => error instanceof OrderDomainError && error.code === "ORDER_INVALID_REQUEST",
  );
});
