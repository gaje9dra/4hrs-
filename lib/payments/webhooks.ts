import type { PaymentStatus } from "@/lib/payments/domain";

export type NormalizedPaymentEvent = {
  providerId: string;
  providerEventReference: string;
  providerPaymentReference: string | null;
  internalPaymentReference: string | null;
  normalizedEventType: string;
  status: PaymentStatus;
  occurredAt: string;
  metadata?: Readonly<Record<string, string>>;
};

export type PaymentWebhookEvent = NormalizedPaymentEvent;

export type PaymentWebhookVerificationContext = {
  signatureVerified: boolean;
  replaySafe: boolean;
};

export function isWebhookReplaySafe(context: PaymentWebhookVerificationContext): boolean {
  return context.signatureVerified && context.replaySafe;
}
