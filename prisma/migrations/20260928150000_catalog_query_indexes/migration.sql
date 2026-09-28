-- Phase 2.6: support catalog price filtering and price sorting.
CREATE INDEX "Product_price_idx" ON "Product"("price");
