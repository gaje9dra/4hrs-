-- Phase 14.5: canonical idempotency for provider-affecting Fulfillment operations.
CREATE TYPE "FulfillmentOperationType" AS ENUM ('SUBMIT','RETRY','RECONCILE');
CREATE TYPE "FulfillmentOperationStatus" AS ENUM ('PENDING','SUCCEEDED','FAILED','AMBIGUOUS');

CREATE TABLE "FulfillmentOperationIdempotency" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fulfillmentId" UUID NOT NULL,
  "operation" "FulfillmentOperationType" NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "status" "FulfillmentOperationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FulfillmentOperationIdempotency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FulfillmentOperationIdempotency_idempotencyKey_key" ON "FulfillmentOperationIdempotency"("idempotencyKey");
CREATE INDEX "FulfillmentOperationIdempotency_fulfillmentId_operation_createdAt_idx" ON "FulfillmentOperationIdempotency"("fulfillmentId","operation","createdAt");
CREATE INDEX "FulfillmentOperationIdempotency_fulfillmentId_status_updatedAt_idx" ON "FulfillmentOperationIdempotency"("fulfillmentId","status","updatedAt");
ALTER TABLE "FulfillmentOperationIdempotency" ADD CONSTRAINT "FulfillmentOperationIdempotency_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
