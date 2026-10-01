import { createPaymentProviderRegistry } from "@/lib/payments/resolver";
import type { PaymentProviderAdapter, PaymentProviderRegistry } from "@/lib/payments/provider";

/**
 * Single production registration point for provider adapters.
 * Phase 11.4 intentionally registers no external provider.
 */
const providerAdapters: readonly PaymentProviderAdapter[] = [];

export function getPaymentProviderRegistry(): PaymentProviderRegistry {
  return createPaymentProviderRegistry(providerAdapters);
}
