-- Phase 14.4: canonical provider-neutral payment refund records.
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING','SUCCEEDED','FAILED','AMBIGUOUS');
CREATE TYPE "PaymentRefundReason" AS ENUM ('CUSTOMER_REQUEST','ORDER_CANCELLED','RETURN_APPROVED','DUPLICATE_PAYMENT','PAYMENT_ERROR','OPERATIONAL_CORRECTION','OTHER');

CREATE TABLE "PaymentRefund" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "paymentId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" "PaymentRefundReason" NOT NULL,
  "note" VARCHAR(1000),
  "providerId" VARCHAR(64),
  "providerReference" VARCHAR(255),
  "failureCode" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");
CREATE INDEX "PaymentRefund_paymentId_createdAt_idx" ON "PaymentRefund"("paymentId","createdAt");
CREATE INDEX "PaymentRefund_paymentId_status_createdAt_idx" ON "PaymentRefund"("paymentId","status","createdAt");
CREATE INDEX "PaymentRefund_providerId_providerReference_idx" ON "PaymentRefund"("providerId","providerReference");
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
