export const NOTIFICATION_MAX_ATTEMPTS = 5;
export const NOTIFICATION_BATCH_SIZE = 20;
export const NOTIFICATION_RETRY_BASE_SECONDS = 60;
export const NOTIFICATION_RETRY_MAX_SECONDS = 60 * 60;
export const NOTIFICATION_PROVIDER_TIMEOUT_MS = 10_000;
export const NOTIFICATION_PROCESSING_LEASE_SECONDS = 120;

export function notificationsEnabled(): boolean {
  return process.env.NOTIFICATION_PROVIDER_ENABLED === "true";
}

export function notificationProviderId(): string {
  return (process.env.NOTIFICATION_PROVIDER_ID ?? "none").trim().toLowerCase();
}

export function notificationProviderMode(): "test" | "production" {
  return process.env.NOTIFICATION_PROVIDER_MODE === "production" ? "production" : "test";
}

export function notificationProcessorScheduleEnabled(): boolean {
  return notificationsEnabled() && notificationProviderMode() === "production";
}