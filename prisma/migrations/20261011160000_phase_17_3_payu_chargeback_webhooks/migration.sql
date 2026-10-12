-- Persist verified PayU chargeback/dispute events and their latest provider state.
CREATE TYPE "PaymentDisputeStatus" AS ENUM (
  'OPEN',
  'CLOSED_CUSTOMER_FAVOUR',
  'CLOSED_MERCHANT_FAVOUR',
  'CLOSED_FRAUD_LIABILITY',
  'UNKNOWN'
);

CREATE TABLE "PaymentDispute" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "providerId" VARCHAR(64) NOT NULL,
  "providerDisputeId" VARCHAR(128) NOT NULL,
  "transactionReference" VARCHAR(64) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "disputeType" VARCHAR(120) NOT NULL,
  "reasonCode" VARCHAR(255),
  "providerStatus" VARCHAR(120) NOT NULL,
  "status" "PaymentDisputeStatus" NOT NULL,
  "providerCreatedAt" TIMESTAMP(3),
  "providerUpdatedAt" TIMESTAMP(3) NOT NULL,
  "lastReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentDispute_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "PaymentDispute_providerId_providerDisputeId_key"
  ON "PaymentDispute"("providerId", "providerDisputeId");
CREATE INDEX "PaymentDispute_paymentId_status_providerUpdatedAt_idx"
  ON "PaymentDispute"("paymentId", "status", "providerUpdatedAt");
CREATE INDEX "PaymentDispute_providerUpdatedAt_idx"
  ON "PaymentDispute"("providerUpdatedAt");
