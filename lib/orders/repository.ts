import { randomUUID } from "node:crypto";
import { Prisma, type OrderStatus as PrismaOrderStatus, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export type OrderRepositoryClient = PrismaClient | Prisma.TransactionClient;
export type OrderRecord = Prisma.OrderGetPayload<Record<string, never>>;
export type OrderWithRelations = Prisma.OrderGetPayload<{ include: { items: true; shippingAddress: true } }>;
export type OrderItemRecord = Prisma.OrderItemGetPayload<Record<string, never>>;
export type OrderAddressSnapshotRecord = Prisma.OrderAddressSnapshotGetPayload<Record<string, never>>;

export type CreateOrderItemInput = {
  productId?: string | null;
  variantId?: string | null;
  productTitleSnapshot: string;
  variantTitleSnapshot?: string | null;
  skuSnapshot?: string | null;
  selectedOptionsSnapshot?: Prisma.InputJsonValue | null;
  quantity: number;
  unitPrice: Prisma.Decimal | string;
  lineTotal: Prisma.Decimal | string;
  currency: string;
};

export type CreateOrderAddressSnapshotInput = {
  recipientName: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label?: string | null;
};

export type CreateOrderInput = {
  customerId: string;
  checkoutReference: string;
  paymentId: string;
  subtotal: Prisma.Decimal | string;
  total: Prisma.Decimal | string;
  currency: string;
  status?: PrismaOrderStatus;
  orderNumber?: string;
};

export type CreateOrderWithItemsInput = CreateOrderInput & {
  items: CreateOrderItemInput[];
  shippingAddress?: CreateOrderAddressSnapshotInput | null;
};

export type OrderRepository = {
  withTransaction<T>(
    work: (repository: OrderRepository) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
  createOrder(input: CreateOrderInput): Promise<OrderRecord>;
  createOrderWithItems(input: CreateOrderWithItemsInput): Promise<OrderWithRelations>;
  createOrderItem(orderId: string, input: CreateOrderItemInput): Promise<OrderItemRecord>;
  createOrderAddressSnapshot(
    orderId: string,
    input: CreateOrderAddressSnapshotInput,
  ): Promise<OrderAddressSnapshotRecord>;
  getOrderById(orderId: string): Promise<OrderWithRelations | null>;
  getOrderByNumber(orderNumber: string): Promise<OrderWithRelations | null>;
  getOrderByCustomer(orderId: string, customerId: string): Promise<OrderWithRelations | null>;
  getOrderByNumberForCustomer(orderNumber: string, customerId: string): Promise<OrderWithRelations | null>;
  listOrdersByCustomer(customerId: string, options?: { page?: number; pageSize?: number }): Promise<{ orders: OrderWithRelations[]; page: number; pageSize: number; total: number; totalPages: number; hasNextPage: boolean }>;
  getOrdersByCustomer(customerId: string): Promise<OrderWithRelations[]>;
  getOrderByCheckout(checkoutReference: string): Promise<OrderWithRelations | null>;
  getOrderByPayment(paymentId: string): Promise<OrderWithRelations | null>;
  transitionOrderStatus(input: { orderId: string; expectedStatus: PrismaOrderStatus; nextStatus: PrismaOrderStatus }): Promise<OrderRecord | null>;
};

function clientOrDefault(client?: OrderRepositoryClient): OrderRepositoryClient {
  return client ?? db;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function assertCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Order currency must be a three-letter uppercase code.");
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("Order item quantity must be a positive integer.");
  }
}

function assertNonNegativeMoney(value: Prisma.Decimal | string, field: string): void {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite() || decimal.isNegative()) throw new Error(`${field} must be a non-negative monetary value.`);
}

function generateOrderNumber(): string {
  return `ORD-${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`;
}

function assertItem(item: CreateOrderItemInput): void {
  assertNonEmpty(item.productTitleSnapshot, "productTitleSnapshot");
  assertCurrency(item.currency);
  assertPositiveQuantity(item.quantity);
  assertNonNegativeMoney(item.unitPrice, "unitPrice");
  assertNonNegativeMoney(item.lineTotal, "lineTotal");
}

function assertOrder(input: CreateOrderInput): void {
  assertNonEmpty(input.customerId, "customerId");
  assertNonEmpty(input.checkoutReference, "checkoutReference");
  assertNonEmpty(input.paymentId, "paymentId");
  assertCurrency(input.currency);
  assertNonNegativeMoney(input.subtotal, "subtotal");
  assertNonNegativeMoney(input.total, "total");
}

export function createOrderRepository(client?: OrderRepositoryClient): OrderRepository {
  const database = clientOrDefault(client);

  const repository: OrderRepository = {
    withTransaction<T>(
      work: (repository: OrderRepository) => Promise<T>,
      options?: { maxWait?: number; timeout?: number },
    ) {
      if ("$transaction" in database) {
        return database.$transaction(
          async (tx) => work(createOrderRepository(tx)),
          {
            ...(options?.maxWait !== undefined ? { maxWait: options.maxWait } : {}),
            ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      }
      return work(createOrderRepository(database));
    },

    async createOrder(input) {
      assertOrder(input);
      return database.order.create({
        data: {
          customerId: input.customerId,
          checkoutReference: input.checkoutReference,
          paymentId: input.paymentId,
          orderNumber: input.orderNumber ?? generateOrderNumber(),
          status: input.status ?? "PENDING",
          subtotal: input.subtotal,
          total: input.total,
          currency: input.currency,
        },
      });
    },

    async createOrderWithItems(input) {
      assertOrder(input);
      if (input.items.length === 0) throw new Error("An Order must contain at least one item.");
      input.items.forEach(assertItem);
      for (const item of input.items) {
        if (item.currency !== input.currency) throw new Error("Order item currency must match Order currency.");
      }

      return repository.withTransaction(async (tx) => {
        const order = await tx.createOrder(input);
        for (const item of input.items) await tx.createOrderItem(order.id, item);
        if (input.shippingAddress) await tx.createOrderAddressSnapshot(order.id, input.shippingAddress);
        const created = await tx.getOrderById(order.id);
        if (!created) throw new Error("Order was not found after creation.");
        return created;
      });
    },

    async createOrderItem(orderId, input) {
      assertNonEmpty(orderId, "orderId");
      assertItem(input);
      const order = await database.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order was not found.");
      if (order.currency !== input.currency) throw new Error("Order item currency must match Order currency.");
      return database.orderItem.create({
        data: {
          orderId,
          productId: input.productId ?? null,
          variantId: input.variantId ?? null,
          productTitleSnapshot: input.productTitleSnapshot,
          variantTitleSnapshot: input.variantTitleSnapshot ?? null,
          skuSnapshot: input.skuSnapshot ?? null,
          selectedOptionsSnapshot: input.selectedOptionsSnapshot ?? undefined,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          lineTotal: input.lineTotal,
          currency: input.currency,
        },
      });
    },

    async createOrderAddressSnapshot(orderId, input) {
      assertNonEmpty(orderId, "orderId");
      assertNonEmpty(input.recipientName, "recipientName");
      assertNonEmpty(input.addressLine1, "addressLine1");
      assertNonEmpty(input.city, "city");
      assertNonEmpty(input.stateOrProvince, "stateOrProvince");
      assertNonEmpty(input.postalCode, "postalCode");
      assertNonEmpty(input.countryCode, "countryCode");
      if (!/^[A-Z]{2}$/.test(input.countryCode)) throw new Error("countryCode must be an uppercase ISO country code.");
      return database.orderAddressSnapshot.create({
        data: {
          orderId,
          recipientName: input.recipientName,
          phone: input.phone ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          stateOrProvince: input.stateOrProvince,
          postalCode: input.postalCode,
          countryCode: input.countryCode,
          label: input.label ?? null,
        },
      });
    },

    getOrderById(orderId) {
      return database.order.findUnique({
        where: { id: orderId },
        include: { items: true, shippingAddress: true },
      });
    },

    getOrderByNumber(orderNumber) {
      return database.order.findUnique({
        where: { orderNumber },
        include: { items: true, shippingAddress: true },
      });
    },

    getOrderByCustomer(orderId, customerId) {
      return database.order.findFirst({
        where: { id: orderId, customerId },
        include: { items: true, shippingAddress: true },
      });
    },

    getOrderByNumberForCustomer(orderNumber, customerId) {
      return database.order.findFirst({
        where: { orderNumber, customerId },
        include: { items: true, shippingAddress: true },
      });
    },

    async listOrdersByCustomer(customerId, options = {}) {
      assertNonEmpty(customerId, "customerId");
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 20;
      if (!Number.isSafeInteger(page) || page < 1) throw new Error("Order page must be a positive integer.");
      if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error("Order page size must be between 1 and 50.");

      const [total, orders] = await Promise.all([
        database.order.count({ where: { customerId } }),
        database.order.findMany({
          where: { customerId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { items: true, shippingAddress: true },
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      return { orders, page, pageSize, total, totalPages, hasNextPage: page < totalPages };
    },

    getOrdersByCustomer(customerId) {
      return database.order.findMany({
        where: { customerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { items: true, shippingAddress: true },
      });
    },

    getOrderByCheckout(checkoutReference) {
      return database.order.findUnique({
        where: { checkoutReference },
        include: { items: true, shippingAddress: true },
      });
    },

    getOrderByPayment(paymentId) {
      return database.order.findUnique({
        where: { paymentId },
        include: { items: true, shippingAddress: true },
      });
    },

    async transitionOrderStatus({ orderId, expectedStatus, nextStatus }) {
      assertNonEmpty(orderId, "orderId");
      if (expectedStatus === nextStatus) throw new Error("Order transition must change state.");
      const result = await database.order.updateMany({
        where: { id: orderId, status: expectedStatus },
        data: { status: nextStatus },
      });
      if (result.count !== 1) return null;
      return database.order.findUnique({ where: { id: orderId } });
    },
  };

  return repository;
}
