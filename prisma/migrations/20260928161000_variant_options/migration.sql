CREATE TABLE "VariantOptionType" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VariantOptionType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariantOptionType_normalizedName_key" ON "VariantOptionType"("normalizedName");

CREATE TABLE "VariantOptionValue" (
  "id" UUID NOT NULL,
  "optionTypeId" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "hex" TEXT,
  "swatch" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VariantOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariantOptionValue_optionTypeId_normalizedValue_key"
  ON "VariantOptionValue"("optionTypeId", "normalizedValue");
CREATE INDEX "VariantOptionValue_optionTypeId_sortOrder_idx"
  ON "VariantOptionValue"("optionTypeId", "sortOrder");

CREATE TABLE "ProductOptionType" (
  "productId" UUID NOT NULL,
  "optionTypeId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductOptionType_pkey" PRIMARY KEY ("productId", "optionTypeId")
);

CREATE INDEX "ProductOptionType_productId_sortOrder_idx"
  ON "ProductOptionType"("productId", "sortOrder");

CREATE TABLE "ProductVariantOptionValue" (
  "variantId" UUID NOT NULL,
  "optionValueId" UUID NOT NULL,
  CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("variantId", "optionValueId")
);

CREATE INDEX "ProductVariantOptionValue_optionValueId_idx"
  ON "ProductVariantOptionValue"("optionValueId");

ALTER TABLE "VariantOptionValue"
  ADD CONSTRAINT "VariantOptionValue_optionTypeId_fkey"
  FOREIGN KEY ("optionTypeId") REFERENCES "VariantOptionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOptionType"
  ADD CONSTRAINT "ProductOptionType_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOptionType"
  ADD CONSTRAINT "ProductOptionType_optionTypeId_fkey"
  FOREIGN KEY ("optionTypeId") REFERENCES "VariantOptionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductVariantOptionValue"
  ADD CONSTRAINT "ProductVariantOptionValue_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantOptionValue"
  ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_fkey"
  FOREIGN KEY ("optionValueId") REFERENCES "VariantOptionValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
