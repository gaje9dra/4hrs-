import { Prisma, type PrismaClient, type FulfillmentStatus as PrismaFulfillmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";

export type FulfillmentRepositoryClient = PrismaClient | Prisma.TransactionClient;
export type FulfillmentRecord = Prisma.FulfillmentGetPayload<Record<string, never>>;
export type FulfillmentWithItems = Prisma.FulfillmentGetPayload<{ include: { items: true } }>;
export type FulfillmentOrderSource = Prisma.OrderGetPayload<{ include: { items: true; shippingAddress: true; payment: true; fulfillment: true } }>;

export type FulfillmentRepository = {
  withTransaction<T>(work: (repository: FulfillmentRepository) => Promise<T>): Promise<T>;
  getById(id: string): Promise<FulfillmentWithItems | null>;
  getByOrderId(orderId: string): Promise<FulfillmentWithItems | null>;
  getByProviderReference(provider: string, providerFulfillmentReference: string): Promise<FulfillmentWithItems | null>;
  getByIdempotencyKey(idempotencyKey: string): Promise<FulfillmentWithItems | null>;
  getOrderForFulfillment(orderId: string): Promise<FulfillmentOrderSource | null>;
  createWithItems(input: { orderId: string; provider: string; idempotencyKey: string; items: readonly { orderItemId: string; quantity: number; providerSku?: string | null; providerVariantReference?: string | null }[] }): Promise<FulfillmentWithItems>;
  transitionStatus(input: { id: string; expectedStatus: PrismaFulfillmentStatus; nextStatus: PrismaFulfillmentStatus; timestamps?: { submittedAt?: Date; completedAt?: Date; failedAt?: Date } }): Promise<FulfillmentWithItems | null>;
};

function clientOrDefault(client?: FulfillmentRepositoryClient): FulfillmentRepositoryClient { return client ?? db; }
function assertNonEmpty(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} must not be empty.`); }

export function createFulfillmentRepository(client?: FulfillmentRepositoryClient): FulfillmentRepository {
  const database = clientOrDefault(client);
  return {
    withTransaction<T>(work: (repository: FulfillmentRepository) => Promise<T>) {
      if ("$transaction" in database) {
        return database.$transaction(async (tx) => work(createFulfillmentRepository(tx)), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      }
      return work(createFulfillmentRepository(database));
    },
    getById(id) { return database.fulfillment.findUnique({ where: { id }, include: { items: true } }); },
    getByOrderId(orderId) { return database.fulfillment.findUnique({ where: { orderId }, include: { items: true } }); },
    getByProviderReference(provider, providerFulfillmentReference) {
      return database.fulfillment.findFirst({ where: { provider, providerFulfillmentReference }, include: { items: true } });
    },
    getByIdempotencyKey(idempotencyKey) { return database.fulfillment.findUnique({ where: { idempotencyKey }, include: { items: true } }); },
    getOrderForFulfillment(orderId) {
      return database.order.findUnique({ where: { id: orderId }, include: { items: true, shippingAddress: true, payment: true, fulfillment: true } });
    },
    async createWithItems(input) {
      assertNonEmpty(input.orderId, "orderId");
      assertNonEmpty(input.provider, "provider");
      assertNonEmpty(input.idempotencyKey, "idempotencyKey");
      if (!input.items.length) throw new Error("Fulfillment must contain at least one item.");
      return database.fulfillment.create({
        data: {
          orderId: input.orderId,
          provider: input.provider,
          idempotencyKey: input.idempotencyKey,
          items: { create: input.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity, providerSku: item.providerSku ?? null, providerVariantReference: item.providerVariantReference ?? null })) },
        },
        include: { items: true },
      });
    },
    async transitionStatus(input) {
      const result = await database.fulfillment.updateMany({
        where: { id: input.id, status: input.expectedStatus },
        data: {
          status: input.nextStatus,
          ...(input.timestamps?.submittedAt ? { submittedAt: input.timestamps.submittedAt } : {}),
          ...(input.timestamps?.completedAt ? { completedAt: input.timestamps.completedAt } : {}),
          ...(input.timestamps?.failedAt ? { failedAt: input.timestamps.failedAt } : {}),
        },
      });
      if (result.count !== 1) return null;
      return database.fulfillment.findUnique({ where: { id: input.id }, include: { items: true } });
    },
  };
}
