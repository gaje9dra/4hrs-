import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";
import { calculateCouponDiscount, CouponEligibilityError } from "@/lib/coupons/calculation";

type CouponTx = Prisma.TransactionClient;
type CouponDatabase = PrismaClient | CouponTx;
const RESERVATION_TTL_MS = 15 * 60 * 1000;

export class CouponRedemptionError extends Error {
  constructor(public readonly code: "COUPON_INVALID" | "COUPON_EXHAUSTED" | "COUPON_LIMIT_REACHED" | "COUPON_RESERVATION_CONFLICT" | "COUPON_RESERVATION_NOT_FOUND", message: string) {
    super(message);
    this.name = "CouponRedemptionError";
  }
}

async function expireSafeReservations(tx: CouponTx, couponId: string, now: Date) {
  const expired = await tx.couponRedemption.findMany({
    where: { couponId, status: "RESERVED", reservationExpiresAt: { lte: now } },
    select: { id: true, checkoutReference: true },
  });
  if (!expired.length) return;
  const references = expired.flatMap((item) => item.checkoutReference ? [item.checkoutReference] : []);
  const payments = references.length ? await tx.payment.findMany({
    where: { checkoutReference: { in: references } },
    select: { checkoutReference: true, status: true },
  }) : [];
  const statusByReference = new Map(payments.map((payment) => [payment.checkoutReference, payment.status]));
  for (const item of expired) {
    const status = item.checkoutReference ? statusByReference.get(item.checkoutReference) : undefined;
    if (status === "FAILED" || status === "CANCELLED") {
      await tx.couponRedemption.updateMany({ where: { id: item.id, status: "RESERVED" }, data: { status: "RELEASED", releasedAt: now, reservationExpiresAt: null } });
    } else if (status) {
      // A known payment attempt with a non-terminal or successful state must retain capacity until reconciliation/finalization.
      await tx.couponRedemption.updateMany({ where: { id: item.id, status: "RESERVED" }, data: { reservationExpiresAt: null } });
    } else {
      await tx.couponRedemption.updateMany({ where: { id: item.id, status: "RESERVED" }, data: { status: "EXPIRED", reservationExpiresAt: null } });
    }
  }
}

export async function reserveCouponForCheckout(input: {
  customerId: string;
  checkoutReference: string;
  code: string;
  eligibleSubtotal: string;
  currency: string;
  database?: PrismaClient;
}) {
  const database = input.database ?? db;
  const code = input.code.trim().toUpperCase();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await database.$transaction(async (tx) => {
        const coupon = await tx.discountCoupon.findUnique({ where: { code } });
        if (!coupon) throw new CouponRedemptionError("COUPON_INVALID", "This coupon code is not valid.");
        await tx.$queryRaw`SELECT "id" FROM "DiscountCoupon" WHERE "id" = ${coupon.id}::uuid FOR UPDATE`;
        const now = new Date();
        await expireSafeReservations(tx, coupon.id, now);

        const existing = await tx.couponRedemption.findUnique({ where: { checkoutReference: input.checkoutReference } });
        if (existing) {
          if (existing.customerId !== input.customerId || existing.couponId !== coupon.id) {
            throw new CouponRedemptionError("COUPON_RESERVATION_CONFLICT", "This checkout cannot use the requested coupon reservation.");
          }
          if (existing.status === "RESERVED" || existing.status === "REDEEMED") return existing;
          throw new CouponRedemptionError("COUPON_RESERVATION_CONFLICT", "This coupon reservation has expired or was released. Revalidate checkout before trying again.");
        }

        const [completed, reserved, customerUses] = await Promise.all([
          tx.couponRedemption.count({ where: { couponId: coupon.id, status: "REDEEMED" } }),
          tx.couponRedemption.count({ where: { couponId: coupon.id, status: "RESERVED" } }),
          tx.couponRedemption.count({ where: { couponId: coupon.id, customerId: input.customerId, status: { in: ["REDEEMED", "RESERVED"] } } }),
        ]);
        if (completed + reserved >= coupon.maxRedemptions) throw new CouponRedemptionError("COUPON_EXHAUSTED", "This coupon has reached its redemption limit.");
        if (coupon.perCustomerLimit !== null && customerUses >= coupon.perCustomerLimit) throw new CouponRedemptionError("COUPON_LIMIT_REACHED", "You have reached this coupon’s usage limit.");
        let calculation;
        try {
          calculation = calculateCouponDiscount({ coupon, eligibleSubtotal: input.eligibleSubtotal, currency: input.currency, now });
        } catch (error) {
          if (error instanceof CouponEligibilityError) throw new CouponRedemptionError(error.code === "COUPON_EXHAUSTED" ? "COUPON_EXHAUSTED" : error.code === "COUPON_LIMIT_REACHED" ? "COUPON_LIMIT_REACHED" : "COUPON_INVALID", error.message);
          throw error;
        }
        return tx.couponRedemption.create({ data: {
          id: randomUUID(),
          couponId: coupon.id,
          checkoutReference: input.checkoutReference,
          customerId: input.customerId,
          couponCodeSnapshot: coupon.code,
          discountPercentSnapshot: calculation.discountPercent,
          status: "RESERVED",
          eligibleTotal: calculation.eligibleSubtotal,
          discountTotal: calculation.discountAmount,
          currency: calculation.currency,
          reservedAt: now,
          reservationExpiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await database.couponRedemption.findUnique({ where: { checkoutReference: input.checkoutReference } });
        if (existing && existing.customerId === input.customerId && existing.couponCodeSnapshot === code && (existing.status === "RESERVED" || existing.status === "REDEEMED")) return existing;
      }
      throw error;
    }
  }
  throw new CouponRedemptionError("COUPON_RESERVATION_CONFLICT", "Coupon capacity is busy. Please retry checkout.");
}

export async function releaseCouponReservation(input: { checkoutReference: string; customerId: string; database?: CouponDatabase }) {
  const database = input.database ?? db;
  const now = new Date();
  const result = await database.couponRedemption.updateMany({
    where: { checkoutReference: input.checkoutReference, customerId: input.customerId, status: "RESERVED" },
    data: { status: "RELEASED", releasedAt: now, reservationExpiresAt: null },
  });
  return result.count;
}

export async function finalizeCouponRedemption(input: { checkoutReference: string; customerId: string; orderId: string; database: CouponTx }) {
  const existing = await input.database.couponRedemption.findUnique({ where: { checkoutReference: input.checkoutReference } });
  if (!existing || existing.customerId !== input.customerId) {
    throw new CouponRedemptionError("COUPON_RESERVATION_NOT_FOUND", "The verified payment has no matching coupon reservation.");
  }
  if (existing.status === "REDEEMED") {
    if (existing.orderId === input.orderId) return existing;
    throw new CouponRedemptionError("COUPON_RESERVATION_CONFLICT", "The coupon was already redeemed by another order.");
  }
  if (existing.status !== "RESERVED") {
    throw new CouponRedemptionError("COUPON_RESERVATION_CONFLICT", "The coupon reservation is no longer valid; payment requires reconciliation.");
  }
  return input.database.couponRedemption.update({
    where: { id: existing.id },
    data: { status: "REDEEMED", orderId: input.orderId, redeemedAt: new Date(), reservationExpiresAt: null },
  });
}
