CREATE TABLE "CustomerAddress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "recipientName" VARCHAR(120) NOT NULL,
  "phone" VARCHAR(32),
  "addressLine1" VARCHAR(200) NOT NULL,
  "addressLine2" VARCHAR(200),
  "city" VARCHAR(100) NOT NULL,
  "stateOrProvince" VARCHAR(100) NOT NULL,
  "postalCode" VARCHAR(32) NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "label" VARCHAR(40) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAddress_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerAddress_customerId_createdAt_idx"
  ON "CustomerAddress" ("customerId", "createdAt");

CREATE INDEX "CustomerAddress_customerId_updatedAt_idx"
  ON "CustomerAddress" ("customerId", "updatedAt");

CREATE UNIQUE INDEX "CustomerAddress_one_default_per_customer"
  ON "CustomerAddress" ("customerId")
  WHERE "isDefault" = true;
