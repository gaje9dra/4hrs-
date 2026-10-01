import type { PaymentAmount, PaymentResult, PaymentStatus } from "@/lib/payments/domain";

export type PaymentProviderCapabilities = {
  currencies: readonly string[];
  paymentMethods: readonly string[];
  refunds: boolean;
  partialRefunds: boolean;
  webhooks: boolean;
  asynchronousConfirmation: boolean;
  cancellation: boolean;
  authorizationCapture: boolean;
};

export type CreatePaymentIntentRequest = {
  paymentReference: string;
  attemptReference: string;
  amount: PaymentAmount;
  customerContext?: Readonly<Record<string, string>>;
  callbackContext?: Readonly<Record<string, string>>;
};

export type CreatePaymentIntentResponse = {
  providerReference: string;
  status: PaymentStatus;
  clientAction?: { type: string; token: string };
};

export type RetrievePaymentStatusRequest = { providerReference: string };
export type VerifyPaymentRequest = { providerReference: string };

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

export interface PaymentProviderAdapter {
  readonly id: string;
  readonly capabilities: PaymentProviderCapabilities;
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse>;
  retrievePaymentStatus(request: RetrievePaymentStatusRequest): Promise<PaymentResult>;
  verifyPayment(request: VerifyPaymentRequest): Promise<PaymentResult>;
  normalizeWebhookEvent(input: { headers: Headers; body: string }): Promise<NormalizedPaymentEvent>;
  cancelPayment?(request: RetrievePaymentStatusRequest): Promise<PaymentResult>;
  refundPayment?(request: RetrievePaymentStatusRequest & { amount?: PaymentAmount }): Promise<PaymentResult>;
}

export type PaymentProviderRegistry = {
  get(providerId: string): PaymentProviderAdapter | undefined;
};

export type PaymentProviderResolver = {
  resolve(context: { customerId: string; checkoutReference: string; currency: string }): PaymentProviderAdapter | undefined;
};
