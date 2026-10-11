import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, type ReferralStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { enqueueNotificationEvent } from "@/lib/notifications/service";

function couponCode(percent: 14 | 25) {
  return `R${percent}-${randomBytes(12).toString("hex").toUpperCase()}`;
}
function newProfileCode() {
  return "4HRS" + randomBytes(8).toString("hex").toUpperCase();
}
function expiryDate() {
  const configured = Number(process.env.REFERRAL_COUPON_TTL_DAYS ?? "365");
  const days = Number.isSafeInteger(configured) && configured >= 1 && configured <= 3650 ? configured : 365;
  return new Date(Date.now() + days * 86400000);
}
async function ensureProfile(customerId: string) {
  const existing = await db.referralProfile.findUnique({ where: { customerId } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.referralProfile.create({ data: { id: randomUUID(), customerId, code: newProfileCode() } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const raced = await db.referralProfile.findUnique({ where: { customerId } });
      if (raced) return raced;
    }
  }
  throw new Error("A referral profile could not be created safely.");
}

async function issueRewardPair(
  tx: Prisma.TransactionClient,
  referral: { id: string; referrerCustomerId: string; invitedCustomerId: string },
  percent: 14 | 25,
  type: "REGISTRATION_14" | "DELIVERED_ORDER_25",
  reason: string,
) {
  for (const recipientCustomerId of [referral.referrerCustomerId, referral.invitedCustomerId]) {
    const existing = await tx.referralReward.findUnique({
      where: { referralId_recipientCustomerId_type: { referralId: referral.id, recipientCustomerId, type } },
    });
    if (existing) continue;
    const coupon = await tx.discountCoupon.create({
      data: {
        id: randomUUID(),
        code: couponCode(percent),
        discountPercent: percent,
        maxRedemptions: 1,
        perCustomerLimit: 1,
        startsAt: new Date(),
        expiresAt: expiryDate(),
        status: "ACTIVE",
        description: `Refer & Earn ${percent}% reward.`,
        recipientCustomerId,
        referralId: referral.id,
        referralRewardType: type,
      },
    });
    await tx.referralReward.create({
      data: { id: randomUUID(), referralId: referral.id, recipientCustomerId, couponId: coupon.id, type, reason },
    });
    await enqueueNotificationEvent(tx, {
      customerId: recipientCustomerId,
      type: type === "REGISTRATION_14" ? "REFERRAL_REGISTRATION_REWARD" : "REFERRAL_DELIVERY_REWARD",
      payload: { couponCode: coupon.code, discountPercent: percent },
      idempotencyKey: `referral-reward:${referral.id}:${recipientCustomerId}:${type}`,
      correlationId: referral.id,
    });
  }
}

export async function getReferralDashboard(customerId: string) {
  const profile = await ensureProfile(customerId);
  const [total, awaitingOrder, awaitingDelivery, rewarded, referrals, coupons] = await Promise.all([
    db.referral.count({ where: { referrerCustomerId: customerId } }),
    db.referral.count({ where: { referrerCustomerId: customerId, status: { in: ["REGISTERED", "AWAITING_ORDER"] } } }),
    db.referral.count({ where: { referrerCustomerId: customerId, status: "AWAITING_DELIVERY" } }),
    db.referral.count({ where: { referrerCustomerId: customerId, status: "REWARDED" } }),
    db.referral.findMany({
      where: { referrerCustomerId: customerId },
      orderBy: [{ registeredAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true, status: true, registeredAt: true, paymentVerifiedAt: true, deliveredAt: true, rewardIssuedAt: true,
        invited: { select: { displayName: true } },
        qualifyingOrder: { select: { id: true } },
        rewards: { where: { recipientCustomerId: customerId }, select: { type: true, issuedAt: true } },
      },
    }),
    db.discountCoupon.findMany({
      where: { recipientCustomerId: customerId, referralId: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: { id: true, code: true, discountPercent: true, status: true, expiresAt: true, createdAt: true, redemptions: { where: { customerId }, select: { status: true } } },
    }),
  ]);
  const now = new Date();
  return {
    referralCode: profile.code,
    referralPath: `/?ref=${encodeURIComponent(profile.code)}`,
    stats: { total, awaitingOrder, awaitingDelivery, rewarded },
    referrals: referrals.map((referral) => ({
      id: referral.id,
      invitee: referral.invited.displayName?.trim() || "Invited customer",
      status: referral.status,
      registeredAt: referral.registeredAt.toISOString(),
      paymentVerifiedAt: referral.paymentVerifiedAt?.toISOString() ?? null,
      deliveredAt: referral.deliveredAt?.toISOString() ?? null,
      rewardIssuedAt: referral.rewardIssuedAt?.toISOString() ?? null,
      hasQualifyingOrder: Boolean(referral.qualifyingOrder),
      registrationRewardIssued: referral.rewards.some((r) => r.type === "REGISTRATION_14"),
      deliveredRewardIssued: referral.rewards.some((r) => r.type === "DELIVERED_ORDER_25"),
    })),
    coupons: coupons.map((coupon) => {
      const redemption = coupon.redemptions[0]?.status ?? null;
      const status = redemption === "REDEEMED" ? "REDEEMED" : coupon.expiresAt <= now ? "EXPIRED" : coupon.status === "INACTIVE" ? "INACTIVE" : coupon.status === "DRAFT" ? "DRAFT" : redemption === "RESERVED" ? "RESERVED" : "AVAILABLE";
      return { id: coupon.id, code: coupon.code, discountPercent: coupon.discountPercent, status, expiresAt: coupon.expiresAt.toISOString(), createdAt: coupon.createdAt.toISOString() };
    }),
  };
}

export type AdminReferralQuery = { search?: string; status?: ReferralStatus; page: number; pageSize: number };
export async function listAdminReferrals(query: AdminReferralQuery) {
  const search = query.search?.trim().slice(0, 120);
  const where: Prisma.ReferralWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(search ? { OR: [
      { referralCodeSnapshot: { contains: search, mode: "insensitive" } },
      { referrer: { email: { contains: search, mode: "insensitive" } } },
      { referrer: { displayName: { contains: search, mode: "insensitive" } } },
      { invited: { email: { contains: search, mode: "insensitive" } } },
      { invited: { displayName: { contains: search, mode: "insensitive" } } },
      { qualifyingOrder: { orderNumber: { contains: search, mode: "insensitive" } } },
    ] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.referral.count({ where }),
    db.referral.findMany({
      where,
      orderBy: [{ registeredAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true, referralCodeSnapshot: true, status: true, registeredAt: true, paymentVerifiedAt: true, deliveredAt: true, rewardIssuedAt: true, qualifyingOrderId: true,
        referrer: { select: { id: true, email: true, displayName: true } },
        invited: { select: { id: true, email: true, displayName: true } },
        qualifyingOrder: { select: { orderNumber: true, payment: { select: { status: true, completedAt: true } } } },
        rewards: { select: { recipientCustomerId: true, type: true, issuedAt: true, coupon: { select: { code: true, status: true, expiresAt: true } } } },
      },
    }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      referralCode: row.referralCodeSnapshot,
      status: row.status,
      registeredAt: row.registeredAt.toISOString(),
      paymentVerifiedAt: row.paymentVerifiedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      rewardIssuedAt: row.rewardIssuedAt?.toISOString() ?? null,
      qualifyingOrderId: row.qualifyingOrderId,
      orderNumber: row.qualifyingOrder?.orderNumber ?? null,
      paymentStatus: row.qualifyingOrder?.payment.status ?? null,
      paymentCompletedAt: row.qualifyingOrder?.payment.completedAt?.toISOString() ?? null,
      referrer: row.referrer,
      invited: row.invited,
      rewards: row.rewards.map((reward) => ({
        type: reward.type,
        recipientCustomerId: reward.recipientCustomerId,
        issuedAt: reward.issuedAt.toISOString(),
        couponCode: reward.coupon.code,
        couponStatus: reward.coupon.status,
        couponExpiresAt: reward.coupon.expiresAt.toISOString(),
      })),
    })),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

export function hasTrustedDeliveryEvidence(input: {
  shipmentProviderId: string;
  deliveredAt: Date;
  events: ReadonlyArray<{ providerId: string; eventTimestamp: Date; source: "WEBHOOK" | "POLLING" | "PROVIDER" | "MANUAL" }>;
}): boolean {
  return input.events.some((event) =>
    event.source !== "MANUAL" &&
    event.providerId.trim().toLowerCase() === input.shipmentProviderId.trim().toLowerCase() &&
    Number.isFinite(event.eventTimestamp.getTime()) &&
    event.eventTimestamp.getTime() <= input.deliveredAt.getTime()
  );
}

export async function processReferralDeliveryReward(shipmentId: string): Promise<{ rewarded: boolean; referralId?: string }> {
  const shipment = await db.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true, status: true, deliveredAt: true, orderId: true, providerId: true,
      trackingEvents: { where: { normalizedStatus: "DELIVERED", source: { in: ["WEBHOOK", "POLLING", "PROVIDER"] } }, select: { providerId: true, eventTimestamp: true, source: true }, orderBy: { eventTimestamp: "desc" }, take: 5 },
      order: { select: { id: true, customerId: true, createdAt: true, status: true, payment: { select: { status: true, completedAt: true, refunds: { select: { status: true, amount: true } } } } } },
    },
  });
  if (!shipment || shipment.status !== "DELIVERED" || !shipment.deliveredAt) return { rewarded: false };
  // A status field alone is not delivery evidence. Require a persisted non-manual provider event
  // for this exact shipping provider and a timestamp no later than the delivered state.
  const trustedDeliveryEvent = hasTrustedDeliveryEvidence({
    shipmentProviderId: shipment.providerId,
    deliveredAt: shipment.deliveredAt,
    events: shipment.trackingEvents,
  });
  if (!trustedDeliveryEvent) return { rewarded: false };
  if (shipment.order.status !== "CONFIRMED" || shipment.order.payment.status !== "SUCCEEDED" || !shipment.order.payment.completedAt) return { rewarded: false };
  // Any initiated/ambiguous/succeeded refund makes the qualifying order ineligible.
  // This intentionally errs on the side of withholding a reward until financial reconciliation is complete.
  if (shipment.order.payment.refunds.some((refund) => refund.status !== "FAILED")) return { rewarded: false };

  const candidate = await db.referral.findFirst({
    where: {
      invitedCustomerId: shipment.order.customerId,
      qualifyingOrderId: shipment.orderId,
      registeredAt: { lte: shipment.order.createdAt },
      status: "AWAITING_DELIVERY",
    },
    orderBy: [{ registeredAt: "asc" }, { id: "asc" }],
  });
  if (!candidate) return { rewarded: false };

  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Referral" WHERE "id" = ${candidate.id}::uuid FOR UPDATE`;
      const referral = await tx.referral.findUnique({ where: { id: candidate.id } });
      if (!referral || referral.status !== "AWAITING_DELIVERY" || referral.qualifyingOrderId !== shipment.orderId) return { rewarded: false };

      const order = await tx.order.findUnique({
        where: { id: shipment.orderId },
        select: { id: true, customerId: true, createdAt: true, status: true, payment: { select: { status: true, completedAt: true, refunds: { select: { status: true, amount: true } } } } },
      });
      const currentShipment = await tx.shipment.findUnique({
        where: { id: shipment.id },
        select: {
          status: true, deliveredAt: true, orderId: true, providerId: true,
          trackingEvents: { where: { normalizedStatus: "DELIVERED", source: { in: ["WEBHOOK", "POLLING", "PROVIDER"] } }, select: { providerId: true, eventTimestamp: true, source: true }, orderBy: { eventTimestamp: "desc" }, take: 5 },
        },
      });
      const currentTrustedDeliveryEvent = currentShipment?.deliveredAt
        ? hasTrustedDeliveryEvidence({
            shipmentProviderId: currentShipment.providerId,
            deliveredAt: currentShipment.deliveredAt,
            events: currentShipment.trackingEvents,
          })
        : false;
      if (!order || !currentShipment || currentShipment.status !== "DELIVERED" || !currentShipment.deliveredAt ||
          !currentTrustedDeliveryEvent ||
          order.status !== "CONFIRMED" || order.customerId !== referral.invitedCustomerId || order.createdAt < referral.registeredAt ||
          order.payment.status !== "SUCCEEDED" || !order.payment.completedAt ||
          order.payment.refunds.some((refund) => refund.status !== "FAILED") ||
          currentShipment.orderId !== order.id) return { rewarded: false };

      await issueRewardPair(tx, referral, 25, "DELIVERED_ORDER_25", "First referred order verified paid and delivered.");
      await tx.referral.update({
        where: { id: referral.id },
        data: { status: "REWARDED", paymentVerifiedAt: order.payment.completedAt, deliveredAt: currentShipment.deliveredAt, rewardIssuedAt: new Date() },
      });
      return { rewarded: true, referralId: referral.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      const existing = await db.referral.findFirst({ where: { invitedCustomerId: shipment.order.customerId, qualifyingOrderId: shipment.orderId, status: "REWARDED" }, select: { id: true } });
      if (existing) return { rewarded: false, referralId: existing.id };
    }
    throw error;
  }
}
