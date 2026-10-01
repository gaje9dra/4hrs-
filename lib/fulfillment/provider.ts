import type { FulfillmentLifecycleStatus } from "@/lib/fulfillment/domain";

export const FULFILLMENT_PROVIDER_ERROR_CODES = [
  "PROVIDER_TIMEOUT", "PROVIDER_NETWORK_ERROR", "PROVIDER_REJECTED", "PROVIDER_INVALID_RESPONSE", "PROVIDER_UNKNOWN_ERROR",
] as const;
export type FulfillmentProviderErrorCode = (typeof FULFILLMENT_PROVIDER_ERROR_CODES)[number];

export type FulfillmentProviderCapabilities = Readonly<{ createFulfillment: boolean; statusLookup: boolean }>;
export type FulfillmentProviderItem = Readonly<{ orderItemId: string; sku: string; variantId: string | null; quantity: number }>;
export type FulfillmentProviderAddress = Readonly<{ recipientName: string; phone: string | null; addressLine1: string; addressLine2: string | null; city: string; stateOrProvince: string; postalCode: string; countryCode: string }>;
export type FulfillmentProviderRequest = Readonly<{ orderReference: string; orderNumber: string; currency: string; items: readonly FulfillmentProviderItem[]; shippingAddress: FulfillmentProviderAddress }>;
export type FulfillmentProviderResponse = Readonly<{ providerId: string; providerFulfillmentReference: string | null; status: FulfillmentLifecycleStatus; providerItemReferences?: Readonly<Record<string, string>> }>;

export interface FulfillmentProviderAdapter {
  readonly id: string;
  readonly capabilities: FulfillmentProviderCapabilities;
  validateConfiguration(): void;
  createFulfillment(request: FulfillmentProviderRequest): Promise<FulfillmentProviderResponse>;
  retrieveFulfillmentStatus(request: { providerFulfillmentReference: string; orderReference: string }): Promise<FulfillmentProviderResponse>;
  normalizeStatus(input: unknown): FulfillmentLifecycleStatus;
  normalizeError(error: unknown): FulfillmentProviderErrorCode;
}
export type FulfillmentProviderRegistry = { get(providerId: string): FulfillmentProviderAdapter | undefined };
export type FulfillmentProviderResolver = { resolve(context: { orderId: string }): FulfillmentProviderAdapter | undefined };
