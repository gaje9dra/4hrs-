-- Phase 5.6: align published catalog status filters with supported sort keys.
-- These composite indexes support the production listing predicate (status = ACTIVE)
-- together with the common database-level sort keys. The primary-key tie-breaker
-- remains in the query for deterministic pagination.
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");
CREATE INDEX "Product_status_updatedAt_idx" ON "Product"("status", "updatedAt");
CREATE INDEX "Product_status_price_idx" ON "Product"("status", "price");
CREATE INDEX "Product_status_title_idx" ON "Product"("status", "title");