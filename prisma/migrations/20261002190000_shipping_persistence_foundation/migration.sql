-- Phase 13.2: shipping persistence foundation
CREATE TYPE "ShipmentStatus" AS ENUM (
  'CREATED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURNED'
);

CREATE TYPE "TrackingEventSource" AS ENUM (
  'WEBHOOK',
  'POLLING',
  'MANUAL',
  'PROVIDER'
);

CREATE TABLE "Shipment" (
  "id" UUID NOT NULL,
  "fulfillmentId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "shipmentReference" VARCHAR(120) NOT NULL,
  "creationIdempotencyKey" VARCHAR(128) NOT NULL,
  "providerId" VARCHAR(64) NOT NULL,
  "providerReference" VARCHAR(255),
  "carrier" VARCHAR(120),
  "trackingNumber" VARCHAR(160),
  "trackingUrl" VARCHAR(1000),
  "service" VARCHAR(120),
  "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_shipmentReference_key" ON "Shipment"("shipmentReference");
CREATE UNIQUE INDEX "Shipment_creationIdempotencyKey_key" ON "Shipment"("creationIdempotencyKey");
CREATE INDEX "Shipment_fulfillmentId_createdAt_idx" ON "Shipment"("fulfillmentId", "createdAt");
CREATE INDEX "Shipment_orderId_createdAt_idx" ON "Shipment"("orderId", "createdAt");
CREATE UNIQUE INDEX "Shipment_providerId_providerReference_key" ON "Shipment"("providerId", "providerReference");
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");
CREATE INDEX "Shipment_status_updatedAt_idx" ON "Shipment"("status", "updatedAt");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_fulfillmentId_fkey"
  FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TrackingEvent" (
  "id" UUID NOT NULL,
  "shipmentId" UUID NOT NULL,
  "providerId" VARCHAR(64) NOT NULL,
  "providerEventId" VARCHAR(255),
  "deduplicationKey" VARCHAR(128) NOT NULL,
  "providerStatus" VARCHAR(120),
  "normalizedStatus" "ShipmentStatus" NOT NULL,
  "eventTimestamp" TIMESTAMP(3) NOT NULL,
  "location" VARCHAR(255),
  "description" VARCHAR(1000),
  "source" "TrackingEventSource" NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackingEvent_shipmentId_providerId_deduplicationKey_key"
  ON "TrackingEvent"("shipmentId", "providerId", "deduplicationKey");
CREATE INDEX "TrackingEvent_shipmentId_eventTimestamp_idx"
  ON "TrackingEvent"("shipmentId", "eventTimestamp");
CREATE INDEX "TrackingEvent_providerId_providerEventId_idx"
  ON "TrackingEvent"("providerId", "providerEventId");
CREATE INDEX "TrackingEvent_normalizedStatus_eventTimestamp_idx"
  ON "TrackingEvent"("normalizedStatus", "eventTimestamp");

ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
