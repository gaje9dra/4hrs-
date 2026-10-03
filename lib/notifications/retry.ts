import { NOTIFICATION_RETRY_BASE_SECONDS, NOTIFICATION_RETRY_MAX_SECONDS } from "./config";

export function retryDelaySeconds(attempt: number, random = Math.random()): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 10));
  const base = Math.min(NOTIFICATION_RETRY_MAX_SECONDS, NOTIFICATION_RETRY_BASE_SECONDS * 2 ** exponent);
  const jitter = Math.floor(base * 0.2 * Math.max(0, Math.min(1, random)));
  return Math.min(NOTIFICATION_RETRY_MAX_SECONDS, base + jitter);
}

export function isRetryableFailure(category: string): boolean {
  return new Set(["RATE_LIMIT","TEMPORARY_PROVIDER","TIMEOUT","CONNECTION"]).has(category);
}