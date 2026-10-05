CREATE TABLE "PaymentRateLimitBucket" (
  "id" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRateLimitBucket_bucketKey_key" ON "PaymentRateLimitBucket"("bucketKey");
CREATE INDEX "PaymentRateLimitBucket_windowStart_idx" ON "PaymentRateLimitBucket"("windowStart");
