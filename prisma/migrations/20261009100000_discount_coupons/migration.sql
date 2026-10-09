CREATE TYPE "CouponStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED', 'EXPIRED');
CREATE TABLE "DiscountCoupon" (
  "id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "discountPercent" INTEGER NOT NULL,
  "maxRedemptions" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "minimumSubtotal" DECIMAL(12,2),
  "maximumDiscountAmount" DECIMAL(12,2),
  "perCustomerLimit" INTEGER,
  "description" VARCHAR(500),
  "internalNote" VARCHAR(1000),
  "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" UUID,
  "updatedByAdminId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscountCoupon_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CouponRedemption" (
  "id" UUID NOT NULL,
  "couponId" UUID NOT NULL,
  "orderId" UUID,
  "customerId" UUID NOT NULL,
  "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "eligibleTotal" DECIMAL(12,2) NOT NULL,
  "discountTotal" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reservationExpiresAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscountCoupon_code_key" ON "DiscountCoupon"("code");
CREATE INDEX "DiscountCoupon_status_startsAt_expiresAt_idx" ON "DiscountCoupon"("status","startsAt","expiresAt");
CREATE INDEX "DiscountCoupon_createdAt_idx" ON "DiscountCoupon"("createdAt");
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_status_createdAt_idx" ON "CouponRedemption"("couponId","status","createdAt");
CREATE INDEX "CouponRedemption_customerId_couponId_status_idx" ON "CouponRedemption"("customerId","couponId","status");
CREATE INDEX "CouponRedemption_status_reservationExpiresAt_idx" ON "CouponRedemption"("status","reservationExpiresAt");
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "DiscountCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt")
VALUES (gen_random_uuid(),'coupons.read','View discount coupons and redemption history',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       (gen_random_uuid(),'coupons.manage','Create and manage discount coupons',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r."name" = 'SUPER_ADMIN' AND p."key" IN ('coupons.read','coupons.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
