-- Seed secure referral permissions in the initial referral migration so fresh databases
-- do not depend on a later patch migration to authorize the admin dashboard.
CREATE TYPE "ReferralStatus" AS ENUM ('REGISTERED', 'AWAITING_ORDER', 'AWAITING_DELIVERY', 'REWARDED', 'INELIGIBLE', 'CANCELLED');
CREATE TYPE "ReferralRewardType" AS ENUM ('REGISTRATION_14', 'DELIVERED_ORDER_25');

CREATE TABLE "ReferralProfile" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Referral" (
  "id" UUID NOT NULL,
  "referrerCustomerId" UUID NOT NULL,
  "invitedCustomerId" UUID NOT NULL,
  "referralCodeSnapshot" VARCHAR(32) NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'REGISTERED',
  "qualifyingOrderId" UUID,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentVerifiedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "rewardIssuedAt" TIMESTAMP(3),
  "ineligibleReason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReferralReward" (
  "id" UUID NOT NULL,
  "referralId" UUID NOT NULL,
  "recipientCustomerId" UUID NOT NULL,
  "couponId" UUID NOT NULL,
  "type" "ReferralRewardType" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DiscountCoupon"
  ADD COLUMN "recipientCustomerId" UUID,
  ADD COLUMN "referralId" UUID,
  ADD COLUMN "referralRewardType" "ReferralRewardType";

CREATE UNIQUE INDEX "ReferralProfile_customerId_key" ON "ReferralProfile"("customerId");
CREATE UNIQUE INDEX "ReferralProfile_code_key" ON "ReferralProfile"("code");
CREATE UNIQUE INDEX "Referral_invitedCustomerId_key" ON "Referral"("invitedCustomerId");
CREATE UNIQUE INDEX "Referral_qualifyingOrderId_key" ON "Referral"("qualifyingOrderId");
CREATE INDEX "Referral_referrerCustomerId_registeredAt_idx" ON "Referral"("referrerCustomerId", "registeredAt");
CREATE INDEX "Referral_status_registeredAt_idx" ON "Referral"("status", "registeredAt");
CREATE UNIQUE INDEX "ReferralReward_couponId_key" ON "ReferralReward"("couponId");
CREATE UNIQUE INDEX "ReferralReward_referralId_recipientCustomerId_type_key" ON "ReferralReward"("referralId", "recipientCustomerId", "type");
CREATE INDEX "ReferralReward_recipientCustomerId_issuedAt_idx" ON "ReferralReward"("recipientCustomerId", "issuedAt");
CREATE INDEX "DiscountCoupon_recipientCustomerId_idx" ON "DiscountCoupon"("recipientCustomerId");
CREATE INDEX "DiscountCoupon_referralId_idx" ON "DiscountCoupon"("referralId");

ALTER TABLE "ReferralProfile" ADD CONSTRAINT "ReferralProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_invitedCustomerId_fkey" FOREIGN KEY ("invitedCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_qualifyingOrderId_fkey" FOREIGN KEY ("qualifyingOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_recipientCustomerId_fkey" FOREIGN KEY ("recipientCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "DiscountCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountCoupon" ADD CONSTRAINT "DiscountCoupon_recipientCustomerId_fkey" FOREIGN KEY ("recipientCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountCoupon" ADD CONSTRAINT "DiscountCoupon_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
