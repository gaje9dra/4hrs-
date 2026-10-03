import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { CommunicationPreferenceError } from "./preferences";

const limiter = createInMemoryAuthenticationRateLimiter();

export function consumeCommunicationRateLimit(customerId: string, request: Request, limit = 30, windowMs = 60 * 60 * 1000): void {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const decision = limiter.consume(`${customerId}:${forwarded}`, limit, windowMs);
  if (!decision.allowed) {
    throw new CommunicationPreferenceError("RATE_LIMITED", "Too many communication preference changes. Please try again later.");
  }
}
