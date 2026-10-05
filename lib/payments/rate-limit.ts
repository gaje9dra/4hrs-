import { db } from "@/lib/db/client";

export type FinancialRateLimitPolicy = Readonly<{
  name: string;
  limit: number;
  windowMs: number;
}>;

export const FINANCIAL_RATE_LIMITS = {
  paymentInitialization: { name: "payment-initialization", limit: 12, windowMs: 60_000 },
  paymentVerification: { name: "payment-verification", limit: 30, windowMs: 60_000 },
  paymentWebhook: { name: "payment-webhook", limit: 120, windowMs: 60_000 },
  refund: { name: "payment-refund", limit: 10, windowMs: 60_000 },
  adminFinancial: { name: "admin-financial", limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, FinancialRateLimitPolicy>;

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}>;

export async function consumeFinancialRateLimit(
  policy: FinancialRateLimitPolicy,
  subject: string,
  now = new Date(),
): Promise<RateLimitDecision> {
  const safeSubject = subject.trim().slice(0, 256);
  if (!safeSubject) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(policy.windowMs / 1000) };

  const windowStartMs = Math.floor(now.getTime() / policy.windowMs) * policy.windowMs;
  const windowStart = new Date(windowStartMs);
  const bucketKey = `${policy.name}:${windowStartMs}:${hashKey(safeSubject)}`;

  try {
    const existing = await db.paymentRateLimitBucket.findUnique({ where: { bucketKey } });
    if (!existing) {
      try {
        await db.paymentRateLimitBucket.create({ data: { bucketKey, windowStart, requestCount: 1 } });
        return { allowed: true, remaining: policy.limit - 1, retryAfterSeconds: Math.max(1, Math.ceil((windowStartMs + policy.windowMs - now.getTime()) / 1000)) };
      } catch (error) {
        const raced = await db.paymentRateLimitBucket.findUnique({ where: { bucketKey } });
        if (!raced) throw error;
      }
    }

    const updated = await db.paymentRateLimitBucket.updateMany({
      where: { bucketKey, requestCount: { lt: policy.limit } },
      data: { requestCount: { increment: 1 } },
    });
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + policy.windowMs - now.getTime()) / 1000));
    if (updated.count === 1) {
      const current = await db.paymentRateLimitBucket.findUnique({ where: { bucketKey } });
      return { allowed: true, remaining: Math.max(0, policy.limit - (current?.requestCount ?? policy.limit)), retryAfterSeconds };
    }
    const current = await db.paymentRateLimitBucket.findUnique({ where: { bucketKey } });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  } catch {
    // Availability of the financial rate limiter is fail-closed: payment-sensitive
    // operations must not become unlimited because the limiter's storage is degraded.
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }
}

export async function pruneFinancialRateLimitBuckets(before: Date): Promise<void> {
  await db.paymentRateLimitBucket.deleteMany({ where: { windowStart: { lt: before } } });
}
