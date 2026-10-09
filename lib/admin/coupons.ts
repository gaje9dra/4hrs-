import { Prisma, type DiscountCoupon } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";

const codePattern = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;
type CouponInput = Record<string, unknown>;

function parseInput(input: CouponInput, partial = false) {
  const code = input.code === undefined && partial ? undefined : typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (code !== undefined && !codePattern.test(code)) throw new AdminError("INVALID_REQUEST", "Coupon code must be 3–64 characters using letters, numbers, hyphens, or underscores.");
  const percent = input.discountPercent === undefined && partial ? undefined : Number(input.discountPercent);
  if (percent !== undefined && (!Number.isInteger(percent) || percent < 1 || percent > 100)) throw new AdminError("INVALID_REQUEST", "Discount percentage must be an integer from 1 through 100.");
  const max = input.maxRedemptions === undefined && partial ? undefined : Number(input.maxRedemptions);
  if (max !== undefined && (!Number.isSafeInteger(max) || max < 1 || max > 100000000)) throw new AdminError("INVALID_REQUEST", "Maximum redemptions must be a positive integer.");
  const expiresAt = input.expiresAt === undefined && partial ? undefined : new Date(String(input.expiresAt));
  if (expiresAt !== undefined && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) throw new AdminError("INVALID_REQUEST", "Expiry must be a valid future date and time.");
  const startsAt = input.startsAt === undefined ? undefined : input.startsAt === null || input.startsAt === "" ? null : new Date(String(input.startsAt));
  if (startsAt instanceof Date && !Number.isFinite(startsAt.getTime())) throw new AdminError("INVALID_REQUEST", "Start date is invalid.");
  if (startsAt instanceof Date && expiresAt instanceof Date && startsAt >= expiresAt) throw new AdminError("INVALID_REQUEST", "Start date must be earlier than expiry.");
  const status = input.status === undefined && partial ? undefined : input.status ?? "DRAFT";
  if (status !== undefined && !["DRAFT", "ACTIVE", "INACTIVE"].includes(String(status))) throw new AdminError("INVALID_REQUEST", "Coupon status is invalid.");
  const optionalMoney = (key: string) => {
    if (input[key] === undefined) return undefined;
    if (input[key] === null || input[key] === "") return null;
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < 0) throw new AdminError("INVALID_REQUEST", key + " must be a non-negative amount.");
    return new Prisma.Decimal(n.toFixed(2));
  };
  const perCustomerLimit = input.perCustomerLimit === undefined ? undefined : input.perCustomerLimit === null || input.perCustomerLimit === "" ? null : Number(input.perCustomerLimit);
  if (typeof perCustomerLimit === "number" && (!Number.isSafeInteger(perCustomerLimit) || perCustomerLimit < 1)) throw new AdminError("INVALID_REQUEST", "Per-customer limit must be a positive integer.");
  const description = input.description === undefined ? undefined : input.description === null ? null : String(input.description).trim();
  const internalNote = input.internalNote === undefined ? undefined : input.internalNote === null ? null : String(input.internalNote).trim();
  if ((description?.length ?? 0) > 500 || (internalNote?.length ?? 0) > 1000) throw new AdminError("INVALID_REQUEST", "Description or internal note is too long.");
  return { code, discountPercent: percent, maxRedemptions: max, expiresAt, startsAt, status: status as "DRAFT"|"ACTIVE"|"INACTIVE"|undefined, minimumSubtotal: optionalMoney("minimumSubtotal"), maximumDiscountAmount: optionalMoney("maximumDiscountAmount"), perCustomerLimit, description, internalNote };
}

function dto(row: DiscountCoupon & { redemptions?: Array<{status: string}>; _count?: {redemptions: number} }) {
  const completed = row.redemptions?.filter((x) => x.status === "REDEEMED").length ?? 0;
  const reserved = row.redemptions?.filter((x) => x.status === "RESERVED").length ?? 0;
  return { id: row.id, code: row.code, discountPercent: row.discountPercent, maxRedemptions: row.maxRedemptions, completedRedemptions: completed, reservedRedemptions: reserved, remainingUses: Math.max(0, row.maxRedemptions - completed - reserved), startsAt: row.startsAt?.toISOString() ?? null, expiresAt: row.expiresAt.toISOString(), minimumSubtotal: row.minimumSubtotal?.toFixed(2) ?? null, maximumDiscountAmount: row.maximumDiscountAmount?.toFixed(2) ?? null, perCustomerLimit: row.perCustomerLimit, description: row.description, internalNote: row.internalNote, status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function listDiscountCoupons(search = "") {
  const q = search.trim().slice(0, 64);
  const rows = await db.discountCoupon.findMany({ where: q ? { code: { contains: q.toUpperCase() } } : undefined, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, include: { redemptions: { where: { status: { in: ["REDEEMED", "RESERVED"] } }, select: { status: true } } } });
  return rows.map(dto);
}

export async function createDiscountCoupon(context: AdminAuthorizationContext, input: CouponInput) {
  const parsed = parseInput(input);
  if (!parsed.code || parsed.discountPercent === undefined || parsed.maxRedemptions === undefined || !parsed.expiresAt || !parsed.status) throw new AdminError("INVALID_REQUEST", "Code, percentage, maximum redemptions, expiry, and status are required.");
  try {
    return await db.$transaction(async tx => {
      const row = await tx.discountCoupon.create({ data: { id: randomUUID(), code: parsed.code!, discountPercent: parsed.discountPercent!, maxRedemptions: parsed.maxRedemptions!, expiresAt: parsed.expiresAt!, status: parsed.status!, ...(parsed.startsAt !== undefined ? { startsAt: parsed.startsAt } : {}), ...(parsed.minimumSubtotal !== undefined ? { minimumSubtotal: parsed.minimumSubtotal } : {}), ...(parsed.maximumDiscountAmount !== undefined ? { maximumDiscountAmount: parsed.maximumDiscountAmount } : {}), ...(parsed.perCustomerLimit !== undefined ? { perCustomerLimit: parsed.perCustomerLimit } : {}), ...(parsed.description !== undefined ? { description: parsed.description } : {}), ...(parsed.internalNote !== undefined ? { internalNote: parsed.internalNote } : {}), createdByAdminId: context.adminUser.id, updatedByAdminId: context.adminUser.id } });
      await auditAdminAction(context, { action: "DISCOUNT_COUPON_CREATED", resourceType: "DiscountCoupon", resourceId: row.id, success: true, metadata: { code: row.code, discountPercent: row.discountPercent, maxRedemptions: row.maxRedemptions, expiresAt: row.expiresAt.toISOString() } }, tx);
      return dto(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminError("CONFLICT", "A coupon with this code already exists.");
    throw error;
  }
}

export async function updateDiscountCoupon(context: AdminAuthorizationContext, input: CouponInput) {
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new AdminError("INVALID_REQUEST", "Coupon ID is invalid.");
  const current = await db.discountCoupon.findUnique({ where: { id: input.id }, include: { redemptions: { where: { status: "REDEEMED" }, select: { id: true } } } });
  if (!current) throw new AdminError("NOT_FOUND", "Coupon was not found.");
  const parsed = parseInput(input, true);
  if (parsed.maxRedemptions !== undefined && parsed.maxRedemptions < current.redemptions.length) throw new AdminError("INVALID_REQUEST", "Maximum redemptions cannot be lower than completed redemptions.");
  const { id } = input;
  const data: Prisma.DiscountCouponUpdateInput = { updatedByAdminId: context.adminUser.id };
  for (const key of ["code","discountPercent","maxRedemptions","expiresAt","startsAt","status","minimumSubtotal","maximumDiscountAmount","perCustomerLimit","description","internalNote"] as const) {
    const value = parsed[key];
    if (value !== undefined) (data as Record<string, unknown>)[key] = value;
  }
  const updated = await db.$transaction(async tx => {
    const row = await tx.discountCoupon.update({ where: { id: id as string }, data });
    await auditAdminAction(context, { action: "DISCOUNT_COUPON_UPDATED", resourceType: "DiscountCoupon", resourceId: row.id, success: true, metadata: { fields: Object.keys(data).filter(k => k !== "updatedByAdminId") } }, tx);
    return row;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return dto(updated);
}
