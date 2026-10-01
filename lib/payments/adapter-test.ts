import type {PaymentProviderAdapter,PaymentProviderCapabilities,PaymentProviderResult} from "@/lib/payments/provider";
export function createDeterministicPaymentTestAdapter(overrides:Partial<PaymentProviderAdapter>={}):PaymentProviderAdapter{
 const capabilities:PaymentProviderCapabilities={createPayment:true,clientAction:false,webhookVerification:true,statusLookup:true,cancellation:false,refunds:false,partialRefunds:false,...overrides.capabilities};
 const result:PaymentProviderResult={providerId:"test-provider",providerPaymentReference:"provider-payment-1",providerAttemptReference:"provider-attempt-1",status:"PROCESSING",clientAction:{type:"NONE"}};
 return {id:"test-provider",capabilities,
  async createPayment(){return result},async retrievePayment(){return result},async verifyPayment(){return {...result,status:"SUCCEEDED"}},
  async verifyWebhook(){return {verified:true,event:{providerId:"test-provider",providerEventReference:"event-1",providerPaymentReference:"provider-payment-1",internalPaymentReference:"payment-1",normalizedEventType:"PAYMENT_SUCCEEDED",status:"SUCCEEDED",occurredAt:"2026-10-01T00:00:00.000Z"}}},
  normalizeStatus(status){if(status==="SUCCEEDED")return "SUCCEEDED";if(status==="FAILED")return "FAILED";return "PROCESSING"},
  normalizeError(){return "PROVIDER_UNKNOWN_ERROR"},...overrides};
}
