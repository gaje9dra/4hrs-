-- Phase 15.6: durable customer anonymization marker.
ALTER TABLE "Customer" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
CREATE INDEX "Customer_anonymizedAt_idx" ON "Customer"("anonymizedAt");
