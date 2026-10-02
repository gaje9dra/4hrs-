import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { AdminError } from "@/lib/admin/errors";
const limiter = createInMemoryAuthenticationRateLimiter();
export function consumeAdminRateLimit(key: string, limit = 30, windowMs = 60_000): void {
  const decision = limiter.consume(key, limit, windowMs);
  if (!decision.allowed) throw new AdminError("RATE_LIMITED", "Too many administrative requests. Please try again later.");
}