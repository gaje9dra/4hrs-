import { Prisma } from "@prisma/client";

export type CouponForCalculation = {
  code: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  discountPercent: number;
  startsAt: Date | null;
  expiresAt: Date;
  minimumSubtotal: Prisma.Decimal | null;
  maximumDiscountAmount: Prisma.Decimal | null;
};

export type CouponCalculation = {
  code: string;
  discountPercent: number;
  eligibleSubtotal: string;
  discountAmount: string;
  payableTotal: string;
  currency: string;
};

export class CouponEligibilityError extends Error {
  constructor(
    public readonly code: "COUPON_INVALID" | "COUPON_INACTIVE" | "COUPON_NOT_STARTED" | "COUPON_EXPIRED" | "COUPON_MINIMUM_NOT_MET" | "COUPON_EXHAUSTED" | "COUPON_LIMIT_REACHED",
    message: string,
  ) {
    super(message);
    this.name = "CouponEligibilityError";
  }
}

/** Single authoritative percentage-discount calculation; monetary values use Decimal and two-decimal half-up rounding. */
export function calculateCouponDiscount(input: {
  coupon: CouponForCalculation;
  eligibleSubtotal: Prisma.Decimal | string;
  currency: string;
  now?: Date;
}): CouponCalculation {
  const { coupon } = input;
  const subtotal = new Prisma.Decimal(input.eligibleSubtotal);
  if (!subtotal.isFinite() || subtotal.isNegative()) throw new Error("Eligible subtotal must be a non-negative monetary amount.");
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Currency must be a three-letter uppercase code.");
  if (!Number.isInteger(coupon.discountPercent) || coupon.discountPercent < 1 || coupon.discountPercent > 100) {
    throw new Error("Coupon percentage is outside the supported range.");
  }
  const now = input.now ?? new Date();
  if (coupon.status !== "ACTIVE") throw new CouponEligibilityError("COUPON_INACTIVE", "This coupon is not active.");
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    throw new CouponEligibilityError("COUPON_NOT_STARTED", "This coupon is not available yet.");
  }
  if (coupon.expiresAt.getTime() <= now.getTime()) {
    throw new CouponEligibilityError("COUPON_EXPIRED", "This coupon has expired.");
  }
  if (coupon.minimumSubtotal && subtotal.lessThan(coupon.minimumSubtotal)) {
    throw new CouponEligibilityError("COUPON_MINIMUM_NOT_MET", "Your merchandise subtotal does not meet this coupon's minimum spend.");
  }
  const percentageAmount = subtotal.mul(coupon.discountPercent).div(100).toDecimalPlaces(2).toDecimalPlaces(2);
  const capped = coupon.maximumDiscountAmount ? Prisma.Decimal.min(percentageAmount, coupon.maximumDiscountAmount) : percentageAmount;
  const discount = Prisma.Decimal.min(subtotal, capped).toDecimalPlaces(2);
  const payable = Prisma.Decimal.max(new Prisma.Decimal(0), subtotal.minus(discount)).toDecimalPlaces(2);
  return {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    eligibleSubtotal: subtotal.toFixed(2),
    discountAmount: discount.toFixed(2),
    payableTotal: payable.toFixed(2),
    currency: input.currency,
  };
}
