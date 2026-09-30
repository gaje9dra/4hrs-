export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type AuthenticationRateLimiter = {
  consume: (key: string, limit: number, windowMs: number) => RateLimitDecision;
};

type Entry = { count: number; resetAt: number };

export function createInMemoryAuthenticationRateLimiter(maxEntries = 10_000): AuthenticationRateLimiter {
  const entries = new Map<string, Entry>();

  return {
    consume(key, limit, windowMs) {
      const now = Date.now();
      const existing = entries.get(key);

      if (!existing || existing.resetAt <= now) {
        if (entries.size >= maxEntries) {
          const firstKey = entries.keys().next().value;
          if (firstKey) entries.delete(firstKey);
        }
        entries.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      }

      existing.count += 1;
      if (existing.count > limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
      }

      return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
    },
  };
}
