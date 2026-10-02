import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
const limiter = createInMemoryAuthenticationRateLimiter();
export function consumeAdminRateLimit(key: string, limit = 30, windowMs = 60_000): void {
  const decision = limiter.consume(key, limit, windowMs);
  if (!decision.allowed) throw new Error("RATE_LIMITED");
}