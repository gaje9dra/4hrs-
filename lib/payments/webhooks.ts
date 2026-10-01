import type { NormalizedPaymentEvent } from "@/lib/payments/provider";

export type { NormalizedPaymentEvent };

export type PaymentWebhookEvent = NormalizedPaymentEvent;

export type PaymentWebhookVerificationContext = {
  signatureVerified: boolean;
  replaySafe: boolean;
};

export function isWebhookReplaySafe(context: PaymentWebhookVerificationContext): boolean {
  return context.signatureVerified && context.replaySafe;
}
