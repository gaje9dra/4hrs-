-- Phase 13.3: server-authoritative Shipment creation idempotency
ALTER TABLE "Shipment" ADD COLUMN "creationIdempotencyKey" VARCHAR(128);
UPDATE "Shipment"
SET "creationIdempotencyKey" = 'legacy-' || "id"
WHERE "creationIdempotencyKey" IS NULL;
ALTER TABLE "Shipment" ALTER COLUMN "creationIdempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Shipment_creationIdempotencyKey_key" ON "Shipment"("creationIdempotencyKey");
