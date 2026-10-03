-- Phase 15.9: persist customer regional presentation preferences
ALTER TABLE "Customer"
  ADD COLUMN "locale" VARCHAR(16) NOT NULL DEFAULT 'en-IN',
  ADD COLUMN "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';

CREATE INDEX "Customer_locale_idx" ON "Customer"("locale");
