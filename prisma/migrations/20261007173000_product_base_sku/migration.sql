ALTER TABLE "Product" ADD COLUMN "baseSku" TEXT;
CREATE UNIQUE INDEX "Product_baseSku_key" ON "Product"("baseSku");