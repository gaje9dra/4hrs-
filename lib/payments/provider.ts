import type { PaymentAmount, PaymentResult, PaymentStatus } from "@/lib/payments/domain";

export const PAYMENT_PROVIDER_ERROR_CODES = [
  "PROVIDER_UNAVAILABLE","PROVIDER_CONFIGURATION_ERROR","PROVIDER_TIMEOUT","PROVIDER_NETWORK_ERROR",
  "PAYMENT_DECLINED","PAYMENT_REQUIRES_ACTION","PAYMENT_INVALID_REQUEST","PAYMENT_NOT_FOUND",
  "PAYMENT_ALREADY_PROCESSED","WEBHOOK_VERIFICATION_FAILED","PROVIDER_UNKNOWN_ERROR",
] as const;
export type PaymentProviderErrorCode = (typeof PAYMENT_PROVIDER_ERROR_CODES)[number];

export type PaymentProviderCapabilities = {
  createPayment: boolean; clientAction: boolean; webhookVerification: boolean; statusLookup: boolean;
  cancellation: boolean; refunds: boolean; partialRefunds: boolean;
};
export type PaymentProviderRequest = {
  paymentReference: string; attemptReference: string; amount: PaymentAmount;
  customerContext?: Readonly<Record<string,string>>;
  callbackContext?: Readonly<Record<string,string>>;
  idempotencyReference: string; metadata?: Readonly<Record<string,string>>;
};
export type PaymentProviderClientAction =
  | { type:"REDIRECT"; redirectUrl:string; publicReference?:string }
  | { type:"EMBEDDED"|"SDK_ACTION"; publicToken:string; publicReference?:string }
  | { type:"NONE" };
export type PaymentProviderResult = {
  providerId:string; providerPaymentReference:string|null; providerAttemptReference:string|null;
  status:PaymentStatus; clientAction:PaymentProviderClientAction;
  errorCode?:PaymentProviderErrorCode; safeMetadata?:Readonly<Record<string,string>>;
};
export type CreatePaymentIntentRequest = PaymentProviderRequest;
export type CreatePaymentIntentResponse = PaymentProviderResult;
export type RetrievePaymentStatusRequest = { providerPaymentReference:string; paymentReference:string };
export type VerifyPaymentRequest = RetrievePaymentStatusRequest;
export type NormalizedPaymentEvent = {
  providerId:string; providerEventReference:string; providerPaymentReference:string|null;
  internalPaymentReference:string|null; normalizedEventType:string; status:PaymentStatus; occurredAt:string;
  metadata?:Readonly<Record<string,string>>;
};
export type PaymentProviderWebhook = { verified:true; event:NormalizedPaymentEvent };

export interface PaymentProviderAdapter {
  readonly id:string;
  readonly capabilities:PaymentProviderCapabilities;
  createPayment(request:PaymentProviderRequest):Promise<PaymentProviderResult>;
  retrievePayment(request:RetrievePaymentStatusRequest):Promise<PaymentProviderResult>;
  verifyPayment(request:VerifyPaymentRequest):Promise<PaymentProviderResult>;
  verifyWebhook(input:{headers:Headers;body:string}):Promise<PaymentProviderWebhook>;
  normalizeStatus(input:unknown):PaymentStatus;
  normalizeError(error:unknown):PaymentProviderErrorCode;
  cancelPayment?(request:RetrievePaymentStatusRequest):Promise<PaymentProviderResult>;
  refundPayment?(request:RetrievePaymentStatusRequest & {amount?:PaymentAmount}):Promise<PaymentProviderResult>;
}
export type PaymentProviderRegistry = { get(providerId:string):PaymentProviderAdapter|undefined };
export type PaymentProviderResolver = { resolve(context:{
  customerId:string; checkoutReference:string; currency:string; providerId?:string;
}):PaymentProviderAdapter|undefined };
export function normalizeProviderStatus(
  adapter:Pick<PaymentProviderAdapter,"normalizeStatus">, providerStatus:unknown,
):PaymentStatus { return adapter.normalizeStatus(providerStatus); }
