import { createPaymentProviderRegistry } from "@/lib/payments/resolver";
import type { PaymentProviderAdapter, PaymentProviderRegistry } from "@/lib/payments/provider";
import { controlledSandboxPaymentProvider } from "@/lib/payments/providers/controlled-sandbox";
import { payuPaymentProvider } from "@/lib/payments/providers/payu";

/**
 * Single production registration point for provider adapters.
 * Phase 11.4 intentionally registers no external provider.
 */
const providerAdapters: readonly PaymentProviderAdapter[] = [controlledSandboxPaymentProvider, payuPaymentProvider];

export function getPaymentProviderRegistry(): PaymentProviderRegistry {
  return createPaymentProviderRegistry(providerAdapters);
}
