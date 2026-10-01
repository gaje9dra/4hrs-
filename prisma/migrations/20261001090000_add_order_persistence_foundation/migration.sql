-- Phase 12.2: Order persistence foundation

CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED');

CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "checkoutReference" VARCHAR(128) NOT NULL,
    "paymentId" UUID NOT NULL,
    "orderNumber" VARCHAR(40) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Order_subtotal_nonnegative" CHECK ("subtotal" >= 0),
    CONSTRAINT "Order_total_nonnegative" CHECK ("total" >= 0),
    CONSTRAINT "Order_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "variantId" UUID,
    "productTitleSnapshot" VARCHAR(255) NOT NULL,
    "variantTitleSnapshot" VARCHAR(255),
    "skuSnapshot" VARCHAR(120),
    "selectedOptionsSnapshot" JSONB,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "OrderItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0),
    CONSTRAINT "OrderItem_lineTotal_nonnegative" CHECK ("lineTotal" >= 0),
    CONSTRAINT "OrderItem_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "OrderAddressSnapshot" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "recipientName" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32),
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "stateOrProvince" VARCHAR(100) NOT NULL,
    "postalCode" VARCHAR(32) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "label" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAddressSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderAddressSnapshot_countryCode_format" CHECK ("countryCode" ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX "Order_checkoutReference_key" ON "Order"("checkoutReference");
CREATE UNIQUE INDEX "Order_paymentId_key" ON "Order"("paymentId");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

CREATE UNIQUE INDEX "OrderAddressSnapshot_orderId_key" ON "OrderAddressSnapshot"("orderId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderAddressSnapshot"
  ADD CONSTRAINT "OrderAddressSnapshot_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
