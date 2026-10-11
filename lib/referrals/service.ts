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
  type: "REGISTRATION_14" | "DELIVERED_ORDER_25" | "PAID_ORDER_25",
  reason: string,
) {
  for (const recipientCustomerId of [referral.referrerCustomerId, referral.invitedCustomerId]) {
    const existing = percent === 25
      ? await tx.referralReward.findFirst({ where: { referralId: referral.id, recipientCustomerId, type: { in: ["DELIVERED_ORDER_25", "PAID_ORDER_25"] } } })
      : await tx.referralReward.findUnique({ where: { referralId_recipientCustomerId_type: { referralId: referral.id, recipientCustomerId, type } } });
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
      type: type === "REGISTRATION_14" ? "REFERRAL_REGISTRATION_REWARD" : type === "PAID_ORDER_25" ? "REFERRAL_PAYMENT_REWARD" : "REFERRAL_DELIVERY_REWARD",
      payload: { couponCode: coupon.code, discountPercent: percent },
      idempotencyKey: `referral-reward:${referral.id}:${recipientCustomerId}:${type}`,
      correlationId: referral.id,
    });
  }
}

export async function processReferralPaymentRewardInTransaction(tx: Prisma.TransactionClient, orderId: string): Promise<{ rewarded: boolean; referralId?: string }> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: {
    id: true, customerId: true, checkoutReference: true, total: true, currency: true, createdAt: true, status: true,
    payment: { select: { customerId: true, checkoutReference: true, amount: true, currency: true, status: true, completedAt: true, refunds: { select: { status: true } } } },
    cancellationRequests: { select: { status: true } },
  } });
  if (!order || !["PENDING", "CONFIRMED"].includes(order.status) || order.payment.customerId !== order.customerId || order.payment.checkoutReference !== order.checkoutReference || order.payment.status !== "SUCCEEDED" || !order.payment.completedAt || !order.payment.amount.equals(order.total) || order.payment.currency !== order.currency) return { rewarded: false };
  const candidate = await tx.referral.findUnique({ where: { invitedCustomerId: order.customerId } });
  if (!candidate) return { rewarded: false };
  await tx.$queryRaw`SELECT "id" FROM "Referral" WHERE "id" = ${candidate.id}::uuid FOR UPDATE`;
  const referral = await tx.referral.findUnique({ where: { id: candidate.id } });
  if (!referral || referral.referrerCustomerId === referral.invitedCustomerId || order.createdAt < referral.registeredAt || (referral.qualifyingOrderId !== null && referral.qualifyingOrderId !== order.id) || !["REGISTERED", "AWAITING_ORDER", "AWAITING_DELIVERY", "AWAITING_PAYMENT_REVIEW"].includes(referral.status)) return { rewarded: false, ...(referral ? { referralId: referral.id } : {}) };
  if (!referral.qualifyingOrderId || referral.status !== "AWAITING_PAYMENT_REVIEW") await tx.referral.update({ where: { id: referral.id }, data: { qualifyingOrderId: order.id, status: "AWAITING_PAYMENT_REVIEW", paymentVerifiedAt: order.payment.completedAt } });
  const hasDisqualifyingFinancialState = order.payment.refunds.some((refund) => refund.status !== "FAILED") || order.cancellationRequests.some((cancellation) => !["REJECTED", "FAILED"].includes(cancellation.status));
  if (hasDisqualifyingFinancialState) return { rewarded: false, referralId: referral.id };
  await issueRewardPair(tx, referral, 25, "PAID_ORDER_25", "First eligible referred order has server-verified successful payment.");
  await tx.referral.update({ where: { id: referral.id }, data: { status: "REWARDED", qualifyingOrderId: order.id, paymentVerifiedAt: order.payment.completedAt, rewardIssuedAt: new Date() } });
  return { rewarded: true, referralId: referral.id };
}

export async function processReferralPaymentReward(orderId: string): Promise<{ rewarded: boolean; referralId?: string }> {
  return db.$transaction((tx) => processReferralPaymentRewardInTransaction(tx, orderId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
}
export async function getReferralDashboard(customerId: string) {
  const profile = await ensureProfile(customerId);
  const [total, awaitingOrder, awaitingPaymentReview, rewarded, referrals, incomingReferral, coupons] = await Promise.all([
    db.referral.count({ where: { referrerCustomerId: customerId } }),
    db.referral.count({ where: { referrerCustomerId: customerId, status: { in: ["REGISTERED", "AWAITING_ORDER"] } } }),
    db.referral.count({ where: { referrerCustomerId: customerId, status: { in: ["AWAITING_PAYMENT_REVIEW", "AWAITING_DELIVERY"] } } }),
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
    db.referral.findUnique({
      where: { invitedCustomerId: customerId },
      select: {
        status: true, registeredAt: true, paymentVerifiedAt: true, rewardIssuedAt: true, qualifyingOrder: { select: { id: true } },
        rewards: { where: { recipientCustomerId: customerId }, select: { type: true } },
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
    stats: { total, awaitingOrder, awaitingPaymentReview, rewarded },
    incomingReferral: incomingReferral ? { status: incomingReferral.status, registeredAt: incomingReferral.registeredAt.toISOString(), paymentVerifiedAt: incomingReferral.paymentVerifiedAt?.toISOString() ?? null, rewardIssuedAt: incomingReferral.rewardIssuedAt?.toISOString() ?? null, hasQualifyingOrder: Boolean(incomingReferral.qualifyingOrder), registrationRewardIssued: incomingReferral.rewards.some((r) => r.type === "REGISTRATION_14"), paymentRewardIssued: incomingReferral.rewards.some((r) => r.type === "PAID_ORDER_25" || r.type === "DELIVERED_ORDER_25") } : null,
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
      paymentRewardIssued: referral.rewards.some((r) => r.type === "PAID_ORDER_25" || r.type === "DELIVERED_ORDER_25"),
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
