import type { PaymentStatus } from "@/lib/payments/domain";

export type PaymentWebhookEvent = {
  providerId: string;
  externalEventId: string;
  type: string;
  paymentReference: string | null;
  status: PaymentStatus;
  receivedAt: string;
  occurredAt: string | null;
};

export type PaymentWebhookVerificationContext = {
  signatureVerified: boolean;
  replaySafe: boolean;
};

export interface PaymentWebhookEventStore {
  hasProcessed(providerId: string, externalEventId: string): Promise<boolean>;
  recordReceived(event: PaymentWebhookEvent): Promise<void>;
  markProcessed(providerId: string, externalEventId: string): Promise<void>;
  markFailed(
    providerId: string,
    externalEventId: string,
    reason: string,
  ): Promise<void>;
}

export function isWebhookReplaySafe(
  context: PaymentWebhookVerificationContext,
): boolean {
  return context.signatureVerified && context.replaySafe;
}
