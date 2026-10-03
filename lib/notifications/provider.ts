import { randomUUID } from "node:crypto";
import { notificationProviderId, notificationProviderMode, notificationsEnabled, NOTIFICATION_PROVIDER_TIMEOUT_MS } from "./config";
import type { NotificationDeliveryResult } from "./types";

export type ProviderMessage = {
  channel: "EMAIL";
  recipientAddress: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

export interface NotificationProvider {
  readonly id: string;
  send(message: ProviderMessage): Promise<NotificationDeliveryResult>;
}

class TestNotificationProvider implements NotificationProvider {
  readonly id = "test";
  async send(message: ProviderMessage): Promise<NotificationDeliveryResult> {
    void message;
    return { outcome: "accepted", providerId: this.id, providerReference: `test_${randomUUID()}` };
  }
}

class UnconfiguredNotificationProvider implements NotificationProvider {
  readonly id = "unconfigured";
  async send(message: ProviderMessage): Promise<NotificationDeliveryResult> {
    void message;
    return { outcome: "failed", providerId: this.id, providerReference: null, failureCategory: "CONFIGURATION", failureCode: "NOTIFICATION_PROVIDER_NOT_CONFIGURED" };
  }
}

export function resolveNotificationProvider(): NotificationProvider {
  if (!notificationsEnabled()) return new UnconfiguredNotificationProvider();
  if (notificationProviderMode() !== "production") {
    if (process.env.NODE_ENV === "production") return new UnconfiguredNotificationProvider();
    return new TestNotificationProvider();
  }
  const id = notificationProviderId();
  if (!id || id === "none" || id === "test") return new UnconfiguredNotificationProvider();
  throw new Error(`Notification provider "${id}" is configured but has no implemented server-side adapter.`);
}

export async function sendWithTimeout(provider: NotificationProvider, message: ProviderMessage): Promise<NotificationDeliveryResult> {
  const timeoutMs = Number(process.env.NOTIFICATION_PROVIDER_TIMEOUT_MS ?? NOTIFICATION_PROVIDER_TIMEOUT_MS);
  const timeout = Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000 ? timeoutMs : NOTIFICATION_PROVIDER_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.send(message),
      new Promise<NotificationDeliveryResult>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("Notification provider timeout"), { code: "NOTIFICATION_PROVIDER_TIMEOUT" })), timeout); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}