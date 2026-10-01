import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";
import { createFulfillmentRepository, type FulfillmentRepository, type FulfillmentWithItems, type FulfillmentOrderSource } from "@/lib/fulfillment/repository";
import { assertOrderFulfillmentEligibility, assertFulfillmentTransition, mapOrderItemsToFulfillment, type FulfillmentLifecycleStatus } from "@/lib/fulfillment/domain";
import { FulfillmentDomainError } from "@/lib/fulfillment/errors";
import type { FulfillmentProviderAdapter, FulfillmentProviderRequest, FulfillmentProviderResolver } from "@/lib/fulfillment/provider";
import { createFulfillmentProviderRegistry, createFulfillmentProviderResolver } from "@/lib/fulfillment/resolver";
import { loadFulfillmentProviderConfiguration } from "@/lib/fulfillment/config";
import { logFulfillmentObservation } from "@/lib/fulfillment/observability";

export type FulfillmentApplicationDependencies = {
  database?: PrismaClient;
  repository?: FulfillmentRepository;
  providerResolver?: FulfillmentProviderResolver;
};

export type CreateFulfillmentInput = { orderId: string; idempotencyKey: string };

export type FulfillmentApplicationService = {
  createFulfillment(input: CreateFulfillmentInput): Promise<FulfillmentWithItems>;
  transitionFulfillment(input: { fulfillmentId: string; expectedStatus: FulfillmentLifecycleStatus; nextStatus: FulfillmentLifecycleStatus }): Promise<FulfillmentWithItems>;
};

function isUniqueConflict(error: unknown): boolean { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"; }
function isSerializationConflict(error: unknown): boolean { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"; }

function validateIdempotencyKey(key: string): void {
  if (!/^[A-Za-z0-9._~-]{16,128}$/.test(key)) throw new FulfillmentDomainError("FULFILLMENT_IDEMPOTENCY_CONFLICT", "Fulfillment idempotency key is invalid.");
}

function providerRequest(order: FulfillmentOrderSource): FulfillmentProviderRequest {
  if (!order.shippingAddress) throw new FulfillmentDomainError("FULFILLMENT_NOT_ELIGIBLE", "Order has no historical shipping address.");
  const items = mapOrderItemsToFulfillment(order.items).map((item) => ({
    orderItemId: item.orderItemId,
    sku: item.sku!,
    variantId: item.variantId,
    quantity: item.quantity,
  }));
  return {
    orderReference: order.id,
    orderNumber: order.orderNumber,
    currency: order.currency,
    items,
    shippingAddress: {
      recipientName: order.shippingAddress.recipientName,
      phone: order.shippingAddress.phone,
      addressLine1: order.shippingAddress.addressLine1,
      addressLine2: order.shippingAddress.addressLine2,
      city: order.shippingAddress.city,
      stateOrProvince: order.shippingAddress.stateOrProvince,
      postalCode: order.shippingAddress.postalCode,
      countryCode: order.shippingAddress.countryCode,
    },
  };
}

export function createFulfillmentApplication(dependencies: FulfillmentApplicationDependencies = {}): FulfillmentApplicationService {
  const database = dependencies.database ?? db;
  const repository = dependencies.repository ?? createFulfillmentRepository();
  const providerResolver = dependencies.providerResolver ?? createFulfillmentProviderResolver({
    registry: createFulfillmentProviderRegistry([]),
    configuration: loadFulfillmentProviderConfiguration(),
  });

  async function createFulfillment(input: CreateFulfillmentInput): Promise<FulfillmentWithItems> {
    validateIdempotencyKey(input.idempotencyKey);
    const startedAt = Date.now();

    const existingKey = await repository.getByIdempotencyKey(input.idempotencyKey);
    if (existingKey) {
      if (existingKey.orderId !== input.orderId) {
        throw new FulfillmentDomainError("FULFILLMENT_IDEMPOTENCY_CONFLICT", "The idempotency key is already bound to another Fulfillment.");
      }
      return existingKey;
    }

    const existingOrderFulfillment = await repository.getByOrderId(input.orderId);
    if (existingOrderFulfillment) {
      throw new FulfillmentDomainError("FULFILLMENT_ALREADY_EXISTS", "The Order already has a Fulfillment.");
    }

    const adapter = providerResolver.resolve({ orderId: input.orderId });
    if (!adapter) throw new FulfillmentDomainError("FULFILLMENT_PROVIDER_NOT_CONFIGURED", "No fulfillment provider is configured.");
    if (!adapter.capabilities.createFulfillment) {
      throw new FulfillmentDomainError("FULFILLMENT_PROVIDER_UNSUPPORTED", "The configured fulfillment provider cannot create Fulfillments.");
    }
    try { adapter.validateConfiguration(); } catch (error) {
      throw new FulfillmentDomainError("FULFILLMENT_PROVIDER_NOT_CONFIGURED", "Fulfillment provider configuration is unavailable.", { cause: error });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await database.$transaction(async (tx) => {
          const txRepository = createFulfillmentRepository(tx);
          const order = await txRepository.getOrderForFulfillment(input.orderId);
          if (!order) throw new FulfillmentDomainError("FULFILLMENT_ORDER_NOT_FOUND", "Order could not be found.");
          if (order.fulfillment) {
            if (order.fulfillment.idempotencyKey === input.idempotencyKey) {
              return txRepository.getById(order.fulfillment.id);
            }
            throw new FulfillmentDomainError("FULFILLMENT_ALREADY_EXISTS", "The Order already has a Fulfillment.");
          }

          assertOrderFulfillmentEligibility({
            status: order.status,
            paymentStatus: order.payment.status,
            paymentCompletedAt: order.payment.completedAt,
            items: order.items,
            shippingAddress: order.shippingAddress,
          });
          const mapped = mapOrderItemsToFulfillment(order.items);
          const result = await txRepository.createWithItems({
            orderId: order.id,
            provider: adapter.id,
            idempotencyKey: input.idempotencyKey,
            items: mapped.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity, providerSku: item.sku, providerVariantReference: item.variantId })),
          });
          return result;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        if (!created) throw new FulfillmentDomainError("FULFILLMENT_DATABASE_ERROR", "Fulfillment could not be loaded after creation.");
        logFulfillmentObservation({ operation: "create", fulfillmentId: created.id, orderId: input.orderId, provider: created.provider, result: "success", durationMs: Date.now() - startedAt });
        return created;
      } catch (error) {
        if (isSerializationConflict(error) && attempt < 2) continue;
        if (isUniqueConflict(error)) {
          const racedKey = await repository.getByIdempotencyKey(input.idempotencyKey);
          if (racedKey) {
            if (racedKey.orderId !== input.orderId) throw new FulfillmentDomainError("FULFILLMENT_IDEMPOTENCY_CONFLICT", "The idempotency key is already bound to another Fulfillment.");
            return racedKey;
          }
          const racedOrder = await repository.getByOrderId(input.orderId);
          if (racedOrder) throw new FulfillmentDomainError("FULFILLMENT_ALREADY_EXISTS", "The Order already has a Fulfillment.");
        }
        const domainError = error instanceof FulfillmentDomainError ? error : new FulfillmentDomainError("FULFILLMENT_DATABASE_ERROR", "Fulfillment creation could not be completed safely.", { cause: error });
        logFulfillmentObservation({ operation: "create", orderId: input.orderId, result: "failure", failureCode: domainError.code, durationMs: Date.now() - startedAt });
        throw domainError;
      }
    }
    throw new FulfillmentDomainError("FULFILLMENT_CONCURRENCY_CONFLICT", "Fulfillment creation conflicted with a concurrent operation.");
  }

  async function transitionFulfillment(input: { fulfillmentId: string; expectedStatus: FulfillmentLifecycleStatus; nextStatus: FulfillmentLifecycleStatus }): Promise<FulfillmentWithItems> {
    const existing = await repository.getById(input.fulfillmentId);
    if (!existing) throw new FulfillmentDomainError("FULFILLMENT_INVALID_STATE", "Fulfillment could not be found.");
    assertFulfillmentTransition(existing.status, input.nextStatus);
    try {
      const updated = await database.$transaction(async (tx) => {
        const txRepository = createFulfillmentRepository(tx);
        const current = await txRepository.getById(input.fulfillmentId);
        if (!current) throw new FulfillmentDomainError("FULFILLMENT_INVALID_STATE", "Fulfillment could not be found.");
        assertFulfillmentTransition(current.status, input.nextStatus);
        const result = await txRepository.transitionStatus({
          id: current.id,
          expectedStatus: current.status,
          nextStatus: input.nextStatus,
          timestamps: input.nextStatus === "SUBMITTED" ? { submittedAt: new Date() } : input.nextStatus === "COMPLETED" ? { completedAt: new Date() } : input.nextStatus === "FAILED" ? { failedAt: new Date() } : undefined,
        });
        if (!result) throw new FulfillmentDomainError("FULFILLMENT_CONCURRENCY_CONFLICT", "Fulfillment state changed concurrently.");
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (!updated) throw new FulfillmentDomainError("FULFILLMENT_DATABASE_ERROR", "Fulfillment could not be loaded after transition.");
      logFulfillmentObservation({ operation: "transition", fulfillmentId: updated.id, orderId: existing.orderId, provider: updated.provider, from: input.expectedStatus, to: input.nextStatus, result: "success" });
      return updated;
    } catch (error) {
      if (error instanceof FulfillmentDomainError) throw error;
      throw new FulfillmentDomainError("FULFILLMENT_CONCURRENCY_CONFLICT", "Fulfillment state changed concurrently.", { cause: error });
    }
  }

  return { createFulfillment, transitionFulfillment };
}

export { providerRequest };
