import { createHash, randomUUID } from "node:crypto";
import {
  Prisma,
  type PrismaClient,
  type ShipmentStatus as PrismaShipmentStatus,
  type TrackingEventSource,
} from "@prisma/client";
import { db } from "@/lib/db/client";
import { assertShipmentTransition } from "@/lib/shipping/domain";

export type ShippingRepositoryClient = PrismaClient | Prisma.TransactionClient;
export type ShipmentWithEvents = Prisma.ShipmentGetPayload<{ include: { trackingEvents: true } }>;
export type FulfillmentShipmentSource = {
  id: string;
  orderId: string;
  provider: string;
  status: "PENDING" | "SUBMITTED" | "FAILED" | "COMPLETED";
  providerFulfillmentReference: string | null;
  order: {
    id: string;
    shippingAddress: {
      recipientName: string;
      phone: string | null;
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      stateOrProvince: string;
      postalCode: string;
      countryCode: string;
    } | null;
  };
};

export type CreateShipmentInput = Readonly<{
  orderId: string;
  fulfillmentId: string;
  providerId: string;
  creationIdempotencyKey: string;
  providerReference?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  service?: string | null;
  status?: PrismaShipmentStatus;
  shippedAt?: Date | null;
}>;

export type CreateTrackingEventInput = Readonly<{
  shipmentId: string;
  providerId: string;
  providerEventId?: string | null;
  providerStatus?: string | null;
  normalizedStatus: PrismaShipmentStatus;
  eventTimestamp: Date;
  location?: string | null;
  description?: string | null;
  source: TrackingEventSource;
}>;

function databaseFor(client?: ShippingRepositoryClient): ShippingRepositoryClient {
  return client ?? db;
}

function nonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function deduplicationKey(input: CreateTrackingEventInput): string {
  if (input.providerEventId?.trim()) return `provider-event:${input.providerEventId.trim()}`;
  const fingerprint = [
    input.providerId,
    input.normalizedStatus,
    input.eventTimestamp.toISOString(),
    input.location ?? "",
    input.description ?? "",
  ].join("\u001f");
  return `fingerprint:${createHash("sha256").update(fingerprint).digest("hex")}`;
}

function shipmentInclude() {
  return { trackingEvents: { orderBy: { eventTimestamp: "asc" as const } } };
}

export type ShippingRepository = ReturnType<typeof createShippingRepository>;

export function createShippingRepository(client?: ShippingRepositoryClient) {
  const database = databaseFor(client);

  return {
    withTransaction<T>(
      work: (repository: ReturnType<typeof createShippingRepository>) => Promise<T>,
    ): Promise<T> {
      if ("$transaction" in database) {
        return database.$transaction(
          async (tx) => work(createShippingRepository(tx)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      }
      return work(createShippingRepository(database));
    },

    getFulfillmentForShipment(fulfillmentId: string): Promise<FulfillmentShipmentSource | null> {
      return database.fulfillment.findUnique({
        where: { id: fulfillmentId },
        select: {
          id: true,
          orderId: true,
          provider: true,
          status: true,
          providerFulfillmentReference: true,
          order: {
            select: {
              id: true,
              shippingAddress: {
                select: {
                  recipientName: true,
                  phone: true,
                  addressLine1: true,
                  addressLine2: true,
                  city: true,
                  stateOrProvince: true,
                  postalCode: true,
                  countryCode: true,
                },
              },
            },
          },
        },
      });
    },

    async createShipment(input: CreateShipmentInput): Promise<ShipmentWithEvents> {
      nonEmpty(input.orderId, "orderId");
      nonEmpty(input.fulfillmentId, "fulfillmentId");
      nonEmpty(input.providerId, "providerId");
      nonEmpty(input.creationIdempotencyKey, "creationIdempotencyKey");

      const fulfillment = await database.fulfillment.findUnique({
        where: { id: input.fulfillmentId },
        select: { id: true, orderId: true, provider: true },
      });
      if (!fulfillment) throw new Error("Fulfillment not found.");
      if (fulfillment.orderId !== input.orderId) {
        throw new Error("Shipment Order does not match the Fulfillment Order.");
      }
      if (fulfillment.provider !== input.providerId) {
        throw new Error("Shipment provider does not match the Fulfillment provider.");
      }

      try {
        return await database.shipment.create({
          data: {
            orderId: input.orderId,
            fulfillmentId: input.fulfillmentId,
            shipmentReference: `SHP-${randomUUID().replaceAll("-", "").toUpperCase()}`,
            creationIdempotencyKey: input.creationIdempotencyKey,
            providerId: input.providerId,
            providerReference: input.providerReference ?? null,
            carrier: input.carrier ?? null,
            trackingNumber: input.trackingNumber ?? null,
            trackingUrl: input.trackingUrl ?? null,
            service: input.service ?? null,
            status: input.status ?? "CREATED",
            shippedAt: input.shippedAt ?? null,
          },
          include: shipmentInclude(),
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await database.shipment.findUnique({
            where: { creationIdempotencyKey: input.creationIdempotencyKey },
            include: shipmentInclude(),
          });
          if (existing) return existing;
        }
        throw error;
      }
    },

    getShipmentByCreationIdempotencyKey(key: string): Promise<ShipmentWithEvents | null> {
      return database.shipment.findUnique({
        where: { creationIdempotencyKey: key },
        include: shipmentInclude(),
      });
    },

    getShipmentById(id: string): Promise<ShipmentWithEvents | null> {
      return database.shipment.findUnique({ where: { id }, include: shipmentInclude() });
    },

    getShipmentByFulfillment(fulfillmentId: string): Promise<ShipmentWithEvents[]> {
      return database.shipment.findMany({
        where: { fulfillmentId },
        include: shipmentInclude(),
        orderBy: { createdAt: "asc" },
      });
    },

    listShipmentsByOrder(orderId: string): Promise<ShipmentWithEvents[]> {
      return database.shipment.findMany({
        where: { orderId },
        include: shipmentInclude(),
        orderBy: { createdAt: "asc" },
      });
    },

    getShipmentByProviderReference(
      providerId: string,
      providerReference: string,
    ): Promise<ShipmentWithEvents | null> {
      return database.shipment.findFirst({
        where: { providerId, providerReference },
        include: shipmentInclude(),
      });
    },

    getShipmentByCustomer(id: string, customerId: string): Promise<ShipmentWithEvents | null> {
      return database.shipment.findFirst({
        where: { id, order: { customerId } },
        include: shipmentInclude(),
      });
    },

    getShipmentByTrackingNumber(trackingNumber: string): Promise<ShipmentWithEvents | null> {
      return database.shipment.findFirst({
        where: { trackingNumber },
        include: shipmentInclude(),
      });
    },

    async transitionStatus(input: {
      id: string;
      expectedStatus: PrismaShipmentStatus;
      nextStatus: PrismaShipmentStatus;
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
    }): Promise<ShipmentWithEvents | null> {
      assertShipmentTransition(input.expectedStatus, input.nextStatus);
      const result = await database.shipment.updateMany({
        where: { id: input.id, status: input.expectedStatus },
        data: {
          status: input.nextStatus,
          ...(input.shippedAt !== undefined ? { shippedAt: input.shippedAt } : {}),
          ...(input.deliveredAt !== undefined ? { deliveredAt: input.deliveredAt } : {}),
        },
      });
      if (result.count !== 1) return null;
      return database.shipment.findUnique({ where: { id: input.id }, include: shipmentInclude() });
    },

    async transitionFromTrackingEvent(input: {
      id: string;
      expectedStatus: PrismaShipmentStatus;
      nextStatus: PrismaShipmentStatus;
      eventTimestamp: Date;
    }): Promise<ShipmentWithEvents | null> {
      const result = await database.shipment.updateMany({
        where: { id: input.id, status: input.expectedStatus },
        data: {
          status: input.nextStatus,
          ...(input.nextStatus === "IN_TRANSIT" ? { shippedAt: input.eventTimestamp } : {}),
          ...(input.nextStatus === "DELIVERED" ? { deliveredAt: input.eventTimestamp } : {}),
        },
      });
      if (result.count !== 1) return null;
      return database.shipment.findUnique({ where: { id: input.id }, include: shipmentInclude() });
    },

    async createTrackingEventIfNew(input: CreateTrackingEventInput): Promise<{ event: Awaited<ReturnType<typeof database.trackingEvent.create>>; created: boolean }> {
      nonEmpty(input.shipmentId, "shipmentId");
      nonEmpty(input.providerId, "providerId");
      const shipment = await database.shipment.findUnique({
        where: { id: input.shipmentId },
        select: { id: true },
      });
      if (!shipment) throw new Error("Shipment not found.");

      const key = deduplicationKey(input);
      try {
        const event = await database.trackingEvent.create({
          data: {
            shipmentId: input.shipmentId,
            providerId: input.providerId,
            providerEventId: input.providerEventId?.trim() || null,
            deduplicationKey: key,
            providerStatus: input.providerStatus?.trim() || null,
            normalizedStatus: input.normalizedStatus,
            eventTimestamp: input.eventTimestamp,
            location: input.location?.trim() || null,
            description: input.description?.trim() || null,
            source: input.source,
          },
        });
        return { event, created: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const event = await database.trackingEvent.findUnique({
            where: {
              shipmentId_providerId_deduplicationKey: {
                shipmentId: input.shipmentId,
                providerId: input.providerId,
                deduplicationKey: key,
              },
            },
          });
          if (event) return { event, created: false };
        }
        throw error;
      }
    },

    async createTrackingEvent(input: CreateTrackingEventInput) {
      nonEmpty(input.shipmentId, "shipmentId");
      nonEmpty(input.providerId, "providerId");
      const shipment = await database.shipment.findUnique({
        where: { id: input.shipmentId },
        select: { id: true },
      });
      if (!shipment) throw new Error("Shipment not found.");

      const key = deduplicationKey(input);
      try {
        return await database.trackingEvent.create({
          data: {
            shipmentId: input.shipmentId,
            providerId: input.providerId,
            providerEventId: input.providerEventId?.trim() || null,
            deduplicationKey: key,
            providerStatus: input.providerStatus?.trim() || null,
            normalizedStatus: input.normalizedStatus,
            eventTimestamp: input.eventTimestamp,
            location: input.location?.trim() || null,
            description: input.description?.trim() || null,
            source: input.source,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return database.trackingEvent.findUnique({
            where: {
              shipmentId_providerId_deduplicationKey: {
                shipmentId: input.shipmentId,
                providerId: input.providerId,
                deduplicationKey: key,
              },
            },
          });
        }
        throw error;
      }
    },

    listTrackingEvents(shipmentId: string, options?: { limit?: number; cursor?: string }) {
      const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
      return database.trackingEvent.findMany({
        where: { shipmentId },
        orderBy: [{ eventTimestamp: "asc" }, { id: "asc" }],
        take: limit,
        ...(options?.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      });
    },

    findTrackingEventByProviderEventId(providerId: string, providerEventId: string) {
      return database.trackingEvent.findFirst({ where: { providerId, providerEventId } });
    },
  };
}
