import type {
  PaymentAmount,
  PaymentIntent,
  PaymentResult,
} from "@/lib/payments/domain";
import type { PaymentProviderAdapter, PaymentProviderRegistry } from "@/lib/payments/provider";

export type ValidatedCheckoutPaymentContext = {
  customerId: string;
  checkoutReference: string;
  amount: PaymentAmount;
};

export type CreatePaymentIntentInput = {
  checkout: ValidatedCheckoutPaymentContext;
  idempotencyKey: string;
};

export type PaymentApplicationService = {
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  getResult(paymentId: string, customerId: string): Promise<PaymentResult>;
};

export type PaymentApplicationDependencies = {
  resolveValidatedCheckout: (
    customerId: string,
    checkoutReference: string,
  ) => Promise<ValidatedCheckoutPaymentContext>;
  providerRegistry: PaymentProviderRegistry;
};

export type ServerPaymentProviderPolicy = {
  selectProvider: (context: ValidatedCheckoutPaymentContext) => string;
};

export type PaymentProviderRuntime = {
  adapter: PaymentProviderAdapter;
};
