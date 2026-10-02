CREATE TABLE "FulfillmentProviderMapping" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "providerId" VARCHAR(64) NOT NULL,
    "providerSku" VARCHAR(120) NOT NULL,
    "providerVariantReference" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FulfillmentProviderMapping_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FulfillmentProviderMapping_providerId_nonempty" CHECK (length(trim("providerId")) > 0),
    CONSTRAINT "FulfillmentProviderMapping_providerSku_nonempty" CHECK (length(trim("providerSku")) > 0)
);

CREATE UNIQUE INDEX "FulfillmentProviderMapping_variantId_providerId_key" ON "FulfillmentProviderMapping"("variantId", "providerId");
CREATE UNIQUE INDEX "FulfillmentProviderMapping_providerId_providerSku_key" ON "FulfillmentProviderMapping"("providerId", "providerSku");
CREATE INDEX "FulfillmentProviderMapping_providerId_active_idx" ON "FulfillmentProviderMapping"("providerId", "active");
CREATE INDEX "FulfillmentProviderMapping_variantId_active_idx" ON "FulfillmentProviderMapping"("variantId", "active");

ALTER TABLE "FulfillmentProviderMapping"
  ADD CONSTRAINT "FulfillmentProviderMapping_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
