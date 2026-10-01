-- Phase 12.7: provider-neutral Fulfillment foundation

CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FAILED', 'COMPLETED');

CREATE TABLE "Fulfillment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "providerFulfillmentReference" VARCHAR(255),
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(100),
    "errorMessage" VARCHAR(500),
    "reconciliationMetadata" JSONB,
    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Fulfillment_provider_nonempty" CHECK (length(trim("provider")) > 0)
);

CREATE TABLE "FulfillmentItem" (
    "id" UUID NOT NULL,
    "fulfillmentId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "providerItemReference" VARCHAR(255),
    "providerSku" VARCHAR(120),
    "providerVariantReference" VARCHAR(255),
    "status" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FulfillmentItem_quantity_positive" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "Fulfillment_orderId_key" ON "Fulfillment"("orderId");
CREATE UNIQUE INDEX "Fulfillment_providerFulfillmentReference_key" ON "Fulfillment"("providerFulfillmentReference");
CREATE UNIQUE INDEX "Fulfillment_idempotencyKey_key" ON "Fulfillment"("idempotencyKey");
CREATE INDEX "Fulfillment_provider_createdAt_idx" ON "Fulfillment"("provider", "createdAt");
CREATE INDEX "Fulfillment_provider_providerFulfillmentReference_idx" ON "Fulfillment"("provider", "providerFulfillmentReference");
CREATE INDEX "Fulfillment_status_createdAt_idx" ON "Fulfillment"("status", "createdAt");
CREATE INDEX "Fulfillment_orderId_status_idx" ON "Fulfillment"("orderId", "status");

CREATE UNIQUE INDEX "FulfillmentItem_orderItemId_key" ON "FulfillmentItem"("orderItemId");
CREATE INDEX "FulfillmentItem_fulfillmentId_idx" ON "FulfillmentItem"("fulfillmentId");
CREATE INDEX "FulfillmentItem_orderItemId_idx" ON "FulfillmentItem"("orderItemId");
CREATE INDEX "FulfillmentItem_providerItemReference_idx" ON "FulfillmentItem"("providerItemReference");

ALTER TABLE "Fulfillment"
  ADD CONSTRAINT "Fulfillment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FulfillmentItem"
  ADD CONSTRAINT "FulfillmentItem_fulfillmentId_fkey"
  FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentItem"
  ADD CONSTRAINT "FulfillmentItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
