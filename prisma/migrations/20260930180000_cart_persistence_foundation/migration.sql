-- Phase 8.2: Cart persistence foundation.
-- Ownership is intentionally absent because no supported customer/session identity
-- mechanism exists yet; Phase 8.2 must not invent an identity system.
CREATE TABLE "Cart" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" UUID NOT NULL,
  "cartId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_positive_check"
  CHECK ("quantity" > 0);

CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");
CREATE INDEX "CartItem_cartId_productId_variantId_idx"
  ON "CartItem"("cartId", "productId", "variantId");

-- PostgreSQL UNIQUE permits multiple NULLs, so two partial constraints are
-- required to prevent duplicate logical items for both product-only and
-- variant-specific purchasability.
CREATE UNIQUE INDEX "CartItem_product_only_unique"
  ON "CartItem"("cartId", "productId")
  WHERE "variantId" IS NULL;

CREATE UNIQUE INDEX "CartItem_variant_unique"
  ON "CartItem"("cartId", "productId", "variantId")
  WHERE "variantId" IS NOT NULL;
