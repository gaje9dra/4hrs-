import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";
import {
  assertFulfillmentEligibleForShipment,
  assertOrderFulfillmentShipmentBoundary,
  assertTrackingEventTransition,
  shouldApplyTrackingEvent,
  isShipmentStatus,
} from "@/lib/shipping/domain";
import { ShippingDomainError } from "@/lib/shipping/errors";
import { createShippingRepository, type ShippingRepository } from "@/lib/shipping/repository";
import type {
  CustomerShipmentDto,
  NormalizedTrackingEvent,
  ShippingProviderResolver,
} from "@/lib/shipping/contracts";
import { logShippingObservation } from "@/lib/shipping/observability";
import { createShippingProviderResolver } from "@/lib/shipping/resolver";

export type ShippingApplicationDependencies = Readonly<{
  database?: PrismaClient;
  repository?: ShippingRepository;
  providerResolver?: ShippingProviderResolver;
}>;

export type ShippingApplicationService = Readonly<{
  createShipmentFromFulfillment(input: {
    fulfillmentId: string;
    orderId: string;
    idempotencyKey?: string;
  }): Promise<Awaited<ReturnType<ShippingRepository["getShipmentById"]>>>;
  processNormalizedTrackingEvent(input: {
    shipmentId: string;
    event: NormalizedTrackingEvent;
  }): Promise<Awaited<ReturnType<ShippingRepository["getShipmentById"]>>>;
  processProviderTrackingEvent(input: {
    shipmentId: string;
    providerId: string;
    payload: unknown;
  }): Promise<Awaited<ReturnType<ShippingRepository["getShipmentById"]>>>;
  getCustomerShipment(input: { shipmentId: string; customerId: string }): Promise<CustomerShipmentDto | null>;
  reconcileShipment(input: { shipmentId: string }): Promise<{
    status: "MATCHED" | "RECONCILIATION_REQUIRED" | "PROVIDER_UNSUPPORTED";
    reason?: string;
  }>;
}>;

function validateIdempotencyKey(key: string): void {
  if (!/^[A-Za-z0-9._~-]{8,128}$/.test(key)) {
    throw new ShippingDomainError("SHIPMENT_IDEMPOTENCY_CONFLICT", "Shipment idempotency key is invalid.");
  }
}

function safeCustomerDto(shipment: NonNullable<Awaited<ReturnType<ShippingRepository["getShipmentById"]>>>): CustomerShipmentDto {
  return {
    status: shipment.status,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    events: shipment.trackingEvents.map((event) => ({
      status: event.normalizedStatus,
      occurredAt: event.eventTimestamp.toISOString(),
      location: event.location,
      description: event.description,
    })),
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function createShippingApplication(
  dependencies: ShippingApplicationDependencies = {},
): ShippingApplicationService {
  const database = dependencies.database ?? db;
  const repository = dependencies.repository ?? createShippingRepository();
  const providerResolver = dependencies.providerResolver ?? createShippingProviderResolver([]);

  async function createShipmentFromFulfillment(input: {
    fulfillmentId: string;
    orderId: string;
    idempotencyKey?: string;
  }) {
    const idempotencyKey = input.idempotencyKey?.trim() || `fulfillment-${input.fulfillmentId}-shipment`;
    validateIdempotencyKey(idempotencyKey);

    const existingByKey = await repository.getShipmentByCreationIdempotencyKey(idempotencyKey);
    if (existingByKey) {
      if (existingByKey.orderId !== input.orderId || existingByKey.fulfillmentId !== input.fulfillmentId) {
        throw new ShippingDomainError(
          "SHIPMENT_IDEMPOTENCY_CONFLICT",
          "The Shipment idempotency key is already bound to another Shipment.",
        );
      }
      return existingByKey;
    }

    const fulfillment = await repository.getFulfillmentForShipment(input.fulfillmentId);
    if (!fulfillment) {
      throw new ShippingDomainError("FULFILLMENT_NOT_FOUND", "Fulfillment could not be found.");
    }

    assertFulfillmentEligibleForShipment({
      fulfillmentExists: true,
      orderId: input.orderId,
      fulfillmentOrderId: fulfillment.orderId,
      status: fulfillment.status,
      provider: fulfillment.provider,
      providerReference: fulfillment.providerFulfillmentReference,
      destinationExists: Boolean(fulfillment.order.shippingAddress),
    });

    assertOrderFulfillmentShipmentBoundary({
      orderId: input.orderId,
      fulfillmentId: input.fulfillmentId,
      shipmentOrderId: fulfillment.orderId,
      shipmentFulfillmentId: fulfillment.id,
    });

    const existingForFulfillment = await repository.getShipmentByFulfillment(input.fulfillmentId);
    if (existingForFulfillment.length > 0) {
      const existing = existingForFulfillment[0];
      if (existing.providerReference === fulfillment.providerFulfillmentReference) return existing;
      throw new ShippingDomainError(
        "SHIPMENT_ALREADY_EXISTS",
        "A Shipment already exists for this Fulfillment with a different provider reference.",
      );
    }

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await database.$transaction(async (tx) => {
        const txRepository = createShippingRepository(tx);
        const raced = await txRepository.getShipmentByCreationIdempotencyKey(idempotencyKey);
        if (raced) {
          if (raced.orderId !== input.orderId || raced.fulfillmentId !== input.fulfillmentId) {
            throw new ShippingDomainError(
              "SHIPMENT_IDEMPOTENCY_CONFLICT",
              "The Shipment idempotency key is already bound to another Shipment.",
            );
          }
          return raced;
        }

        const current = await txRepository.getFulfillmentForShipment(input.fulfillmentId);
        if (!current) throw new ShippingDomainError("FULFILLMENT_NOT_FOUND", "Fulfillment could not be found.");

        assertFulfillmentEligibleForShipment({
          fulfillmentExists: true,
          orderId: input.orderId,
          fulfillmentOrderId: current.orderId,
          status: current.status,
          provider: current.provider,
          providerReference: current.providerFulfillmentReference,
          destinationExists: Boolean(current.order.shippingAddress),
        });

        const existing = await txRepository.getShipmentByFulfillment(current.id);
        if (existing.length > 0) {
          if (existing[0].providerReference === current.providerFulfillmentReference) return existing[0];
          throw new ShippingDomainError("SHIPMENT_ALREADY_EXISTS", "A Shipment already exists for this Fulfillment.");
        }

        const created = await txRepository.createShipment({
          orderId: current.orderId,
          fulfillmentId: current.id,
          providerId: current.provider,
          creationIdempotencyKey: idempotencyKey,
          providerReference: current.providerFulfillmentReference,
          status: "CREATED",
        });
        logShippingObservation({
          operation: "handoff",
          shipmentId: created.id,
          fulfillmentId: current.id,
          orderId: current.orderId,
          providerId: current.provider,
          result: "success",
        });
        return created;
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === "P2034"
            && attempt < 2
          ) {
            continue;
          }
          throw error;
        }
      }
      throw new Error("Shipment transaction retry limit reached.");
    } catch (error) {
      if (error instanceof ShippingDomainError) throw error;
      if (isUniqueConflict(error)) {
        const raced = await repository.getShipmentByCreationIdempotencyKey(idempotencyKey);
        if (raced) return raced;
      }
      throw new ShippingDomainError(
        "SHIPMENT_CONCURRENCY_CONFLICT",
        "Shipment creation conflicted with a concurrent operation.",
        { cause: error },
      );
    }
  }

  async function processNormalizedTrackingEvent(input: {
    shipmentId: string;
    event: NormalizedTrackingEvent;
  }) {
    if (!isShipmentStatus(input.event.normalizedStatus)) {
      throw new ShippingDomainError("UNSUPPORTED_PROVIDER_STATUS", "Provider event normalized to an unsupported Shipment status.");
    }
    if (input.event.providerId.trim() === "") {
      throw new ShippingDomainError("INVALID_TRACKING_EVENT", "Tracking event provider identity is required.");
    }
    if (Number.isNaN(input.event.eventTimestamp.getTime())) {
      throw new ShippingDomainError("INVALID_TRACKING_EVENT", "Tracking event timestamp is invalid.");
    }

    const trackingInput = {
      shipmentId: input.shipmentId,
      providerId: input.event.providerId,
      providerEventId: input.event.providerEventId,
      providerStatus: input.event.providerStatus,
      normalizedStatus: input.event.normalizedStatus,
      eventTimestamp: input.event.eventTimestamp,
      location: input.event.location,
      description: input.event.description,
      source: "PROVIDER" as const,
    };

    try {
      return await database.$transaction(async (tx) => {
        const txRepository = createShippingRepository(tx);
        const shipment = await txRepository.getShipmentById(input.shipmentId);
        if (!shipment) throw new ShippingDomainError("SHIPMENT_NOT_FOUND", "Shipment could not be found.");
        if (shipment.providerId !== input.event.providerId) {
          throw new ShippingDomainError("INVALID_TRACKING_EVENT", "Tracking event provider does not match the Shipment provider.");
        }

        const persisted = await txRepository.createTrackingEventIfNew(trackingInput);

        if (!persisted.created) {
          logShippingObservation({ operation: "tracking-event", shipmentId: shipment.id, providerId: input.event.providerId, result: "duplicate" });
          return shipment;
        }

        const refreshed = await txRepository.getShipmentById(shipment.id);
        if (!refreshed) throw new ShippingDomainError("SHIPMENT_NOT_FOUND", "Shipment could not be found.");

        const previousEvents = refreshed.trackingEvents.filter((event) => event.id !== persisted.event.id);
        const latestEvent = previousEvents.at(-1);
        const decision = shouldApplyTrackingEvent(
          shipment.status,
          input.event.normalizedStatus,
          input.event.eventTimestamp,
          latestEvent?.eventTimestamp ?? null,
        );

        if (decision !== "APPLY") {
          logShippingObservation({
            operation: "tracking-event",
            shipmentId: shipment.id,
            providerId: input.event.providerId,
            result: "history-only",
            from: shipment.status,
            to: input.event.normalizedStatus,
          });
          return refreshed;
        }

        assertTrackingEventTransition(shipment.status, input.event.normalizedStatus);
        const updated = await txRepository.transitionFromTrackingEvent({
          id: shipment.id,
          expectedStatus: shipment.status,
          nextStatus: input.event.normalizedStatus,
          eventTimestamp: input.event.eventTimestamp,
        });
        if (!updated) {
          throw new ShippingDomainError(
            "SHIPMENT_CONCURRENCY_CONFLICT",
            "Shipment state changed while processing the tracking event.",
          );
        }
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ShippingDomainError) throw error;
      if (isUniqueConflict(error)) {
        const existingEvent = await repository.findTrackingEventByInput(trackingInput);
        if (existingEvent) {
          const current = await repository.getShipmentById(input.shipmentId);
          if (current) {
            logShippingObservation({
              operation: "tracking-event",
              shipmentId: current.id,
              providerId: input.event.providerId,
              result: "duplicate",
            });
            return current;
          }
        }
      }
      throw new ShippingDomainError(
        "SHIPMENT_CONCURRENCY_CONFLICT",
        "Tracking event processing conflicted with another operation.",
        { cause: error },
      );
    }
  }

  async function processProviderTrackingEvent(input: {
    shipmentId: string;
    providerId: string;
    payload: unknown;
  }) {
    const adapter = providerResolver?.resolve(input.providerId);
    if (!adapter) {
      throw new ShippingDomainError(
        "UNSUPPORTED_PROVIDER_STATUS",
        "No verified Shipping provider adapter is available for this provider.",
      );
    }
    let event: NormalizedTrackingEvent;
    try {
      event = adapter.normalizeTrackingEvent(input.payload);
    } catch (error) {
      throw new ShippingDomainError(
        "UNSUPPORTED_PROVIDER_STATUS",
        "The provider tracking status is unsupported or invalid.",
        { cause: error },
      );
    }
    if (event.providerId !== input.providerId) {
      throw new ShippingDomainError("INVALID_TRACKING_EVENT", "Provider adapter returned a mismatched provider identity.");
    }
    return processNormalizedTrackingEvent({ shipmentId: input.shipmentId, event });
  }

  async function getCustomerShipment(input: { shipmentId: string; customerId: string }): Promise<CustomerShipmentDto | null> {
    const shipment = await repository.getShipmentByCustomer(input.shipmentId, input.customerId);
    return shipment ? safeCustomerDto(shipment) : null;
  }

  async function reconcileShipment(input: { shipmentId: string }) {
    const shipment = await repository.getShipmentById(input.shipmentId);
    if (!shipment) throw new ShippingDomainError("SHIPMENT_NOT_FOUND", "Shipment could not be found.");

    if (!shipment.providerReference) {
      return {
        status: "RECONCILIATION_REQUIRED" as const,
        reason: "Shipment has no provider reference.",
      };
    }

    const adapter = providerResolver?.resolve(shipment.providerId);
    if (!adapter || !adapter.capabilities.trackingLookup) {
      return {
        status: "PROVIDER_UNSUPPORTED" as const,
        reason: "No verified provider tracking/status lookup is available.",
      };
    }

    return {
      status: "RECONCILIATION_REQUIRED" as const,
      reason: "A verified provider reconciliation operation is not implemented in this phase.",
    };
  }

  return {
    createShipmentFromFulfillment,
    processNormalizedTrackingEvent,
    processProviderTrackingEvent,
    getCustomerShipment,
    reconcileShipment,
  };
}
