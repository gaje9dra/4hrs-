-- Phase 11.2: provider-neutral Payment persistence foundation
CREATE TYPE "PaymentStatus" AS ENUM (
  'CREATED',
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

CREATE TYPE "PaymentEventProcessingStatus" AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'FAILED'
);

CREATE TABLE "Payment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "checkoutReference" VARCHAR(128) NOT NULL,
  "internalReference" VARCHAR(64) NOT NULL,
  "providerId" VARCHAR(64),
  "providerReference" VARCHAR(255),
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAttempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "paymentId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "providerId" VARCHAR(64),
  "providerAttemptReference" VARCHAR(255),
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "failureCode" VARCHAR(100),
  "failureCategory" VARCHAR(100),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "providerId" VARCHAR(64) NOT NULL,
  "providerEventId" VARCHAR(255) NOT NULL,
  "eventType" VARCHAR(120) NOT NULL,
  "normalizedEventType" VARCHAR(120),
  "paymentId" UUID,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurredAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "processingStatus" "PaymentEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "processingError" VARCHAR(500),
  "metadata" JSONB,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentIdempotency" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "checkoutReference" VARCHAR(128) NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "key" VARCHAR(255) NOT NULL,
  "requestFingerprint" VARCHAR(128) NOT NULL,
  "paymentId" UUID NOT NULL,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "PaymentIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_internalReference_key" ON "Payment"("internalReference");
CREATE UNIQUE INDEX "Payment_customerId_checkoutReference_key" ON "Payment"("customerId", "checkoutReference");
CREATE INDEX "Payment_customerId_createdAt_idx" ON "Payment"("customerId", "createdAt");
CREATE INDEX "Payment_checkoutReference_idx" ON "Payment"("checkoutReference");
CREATE INDEX "Payment_providerId_providerReference_idx" ON "Payment"("providerId", "providerReference");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");
CREATE INDEX "PaymentAttempt_paymentId_createdAt_idx" ON "PaymentAttempt"("paymentId", "createdAt");
CREATE INDEX "PaymentAttempt_providerId_providerAttemptReference_idx" ON "PaymentAttempt"("providerId", "providerAttemptReference");
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

CREATE UNIQUE INDEX "PaymentEvent_providerId_providerEventId_key" ON "PaymentEvent"("providerId", "providerEventId");
CREATE INDEX "PaymentEvent_paymentId_receivedAt_idx" ON "PaymentEvent"("paymentId", "receivedAt");
CREATE INDEX "PaymentEvent_providerId_receivedAt_idx" ON "PaymentEvent"("providerId", "receivedAt");
CREATE INDEX "PaymentEvent_processingStatus_receivedAt_idx" ON "PaymentEvent"("processingStatus", "receivedAt");

CREATE UNIQUE INDEX "PaymentIdempotency_customerId_operation_key_key" ON "PaymentIdempotency"("customerId", "operation", "key");
CREATE INDEX "PaymentIdempotency_paymentId_idx" ON "PaymentIdempotency"("paymentId");
CREATE INDEX "PaymentIdempotency_customerId_checkoutReference_idx" ON "PaymentIdempotency"("customerId", "checkoutReference");
CREATE INDEX "PaymentIdempotency_expiresAt_idx" ON "PaymentIdempotency"("expiresAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentIdempotency" ADD CONSTRAINT "PaymentIdempotency_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
