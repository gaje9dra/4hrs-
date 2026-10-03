import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { AuthenticationError } from "@/lib/auth/errors";

const limiter = createInMemoryAuthenticationRateLimiter();

export function consumeCustomerPrivacyRateLimit(customerId: string, request: Request, limit: number, windowMs: number): void {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const decision = limiter.consume(`privacy:${customerId}:${forwarded}`, limit, windowMs);
  if (!decision.allowed) {
    throw new AuthenticationError("RATE_LIMITED", "Too many privacy requests. Please try again later.");
  }
}
