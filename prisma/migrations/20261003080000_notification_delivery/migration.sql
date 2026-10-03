-- Phase 15.7: durable provider-neutral notification delivery
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING','PROCESSING','SENT','DELIVERED','RETRY_SCHEDULED','FAILED','AMBIGUOUS');
CREATE TYPE "NotificationFailureCategory" AS ENUM ('VALIDATION','CONFIGURATION','RATE_LIMIT','TEMPORARY_PROVIDER','TIMEOUT','CONNECTION','PERMANENT_RECIPIENT','MALFORMED_RESPONSE','AMBIGUOUS_RESULT','RENDERING');

ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'ORDER_CONFIRMED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_SUCCEEDED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'FULFILLMENT_SUBMITTED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'FULFILLMENT_FAILED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SHIPMENT_CREATED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SHIPMENT_IN_TRANSIT';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SHIPMENT_OUT_FOR_DELIVERY';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SHIPMENT_DELIVERED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SHIPMENT_DELIVERY_FAILED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'CASE_CREATED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'CASE_RESOLVED';

ALTER TABLE "NotificationEvent"
  ADD COLUMN "idempotencyKey" VARCHAR(255),
  ADD COLUMN "correlationId" VARCHAR(128);

CREATE UNIQUE INDEX "NotificationEvent_idempotencyKey_key" ON "NotificationEvent"("idempotencyKey");
CREATE INDEX "NotificationEvent_type_createdAt_idx" ON "NotificationEvent"("type","createdAt");

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "notificationEventId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "templateKey" VARCHAR(120) NOT NULL,
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'en-IN',
  "recipientAddress" VARCHAR(320),
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "providerId" VARCHAR(64),
  "providerReference" VARCHAR(255),
  "failureCategory" "NotificationFailureCategory",
  "failureCode" VARCHAR(120),
  "correlationId" VARCHAR(128),
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_createdAt_idx" ON "NotificationDelivery"("status","nextAttemptAt","createdAt");
CREATE INDEX "NotificationDelivery_customerId_createdAt_idx" ON "NotificationDelivery"("customerId","createdAt");
CREATE INDEX "NotificationDelivery_notificationEventId_idx" ON "NotificationDelivery"("notificationEventId");
CREATE INDEX "NotificationDelivery_providerId_providerReference_idx" ON "NotificationDelivery"("providerId","providerReference");
CREATE INDEX "NotificationDelivery_correlationId_createdAt_idx" ON "NotificationDelivery"("correlationId","createdAt");

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_notificationEventId_fkey"
  FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
