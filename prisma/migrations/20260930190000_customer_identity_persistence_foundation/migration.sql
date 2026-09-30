-- Phase 9.2: customer identity, credentials, sessions, and nullable Cart ownership.
-- Existing Cart rows remain anonymous (customer_id IS NULL).

CREATE TYPE "CustomerAccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'SUSPENDED', 'PENDING_VERIFICATION');

CREATE TABLE "Customer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "status" "CustomerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

CREATE TABLE "CustomerCredential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCredential_customerId_key" ON "CustomerCredential"("customerId");

CREATE TABLE "CustomerSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL,
    "sessionTokenHash" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSession_sessionTokenHash_key" ON "CustomerSession"("sessionTokenHash");
CREATE INDEX "CustomerSession_customerId_revokedAt_expiresAt_idx" ON "CustomerSession"("customerId", "revokedAt", "expiresAt");
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");

ALTER TABLE "Cart" ADD COLUMN "customerId" UUID;
CREATE UNIQUE INDEX "Cart_customerId_key" ON "Cart"("customerId");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerCredential" ADD CONSTRAINT "CustomerCredential_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
