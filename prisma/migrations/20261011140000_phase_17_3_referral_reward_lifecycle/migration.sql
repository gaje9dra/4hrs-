-- Preserve reward issuance history while auditing coupon availability changes.
CREATE TABLE "ReferralRewardLifecycleEvent" (
  "id" UUID NOT NULL,
  "referralRewardId" UUID NOT NULL,
  "eventKey" VARCHAR(255) NOT NULL,
  "eventType" VARCHAR(80) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "previousCouponStatus" "CouponStatus",
  "nextCouponStatus" "CouponStatus",
  "redemptionStatus" "CouponRedemptionStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRewardLifecycleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralRewardLifecycleEvent_referralRewardId_fkey" FOREIGN KEY ("referralRewardId") REFERENCES "ReferralReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReferralRewardLifecycleEvent_eventKey_key" ON "ReferralRewardLifecycleEvent"("eventKey");
CREATE INDEX "ReferralRewardLifecycleEvent_referralRewardId_createdAt_idx" ON "ReferralRewardLifecycleEvent"("referralRewardId", "createdAt");
