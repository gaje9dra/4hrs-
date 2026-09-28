CREATE TYPE "InventoryAdjustmentReason" AS ENUM (
  'INITIAL_STOCK',
  'MANUAL_ADJUSTMENT',
  'STOCK_RECEIPT',
  'DAMAGED',
  'LOST',
  'RETURNED',
  'CORRECTION'
);

CREATE TABLE "Inventory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "variantId" UUID NOT NULL,
  "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "onHand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Inventory_onHand_check" CHECK ("onHand" >= 0),
  CONSTRAINT "Inventory_reserved_check" CHECK ("reserved" >= 0 AND "reserved" <= "onHand"),
  CONSTRAINT "Inventory_lowStockThreshold_check" CHECK ("lowStockThreshold" >= 0)
);
CREATE UNIQUE INDEX "Inventory_variantId_key" ON "Inventory"("variantId");
CREATE INDEX "Inventory_trackingEnabled_idx" ON "Inventory"("trackingEnabled");

CREATE TABLE "InventoryTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inventoryId" UUID NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "previousOnHand" INTEGER NOT NULL,
  "resultingOnHand" INTEGER NOT NULL,
  "reason" "InventoryAdjustmentReason" NOT NULL,
  "actorId" TEXT,
  "source" TEXT,
  "note" TEXT,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryTransaction_result_check" CHECK ("resultingOnHand" = "previousOnHand" + "quantityDelta"),
  CONSTRAINT "InventoryTransaction_previous_check" CHECK ("previousOnHand" >= 0),
  CONSTRAINT "InventoryTransaction_resulting_check" CHECK ("resultingOnHand" >= 0)
);
CREATE INDEX "InventoryTransaction_inventoryId_createdAt_idx" ON "InventoryTransaction"("inventoryId","createdAt");
CREATE INDEX "InventoryTransaction_reason_createdAt_idx" ON "InventoryTransaction"("reason","createdAt");
