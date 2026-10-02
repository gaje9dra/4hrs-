import type { ShippingProviderAdapter, ShippingProviderResolver } from "@/lib/shipping/contracts";

export function createShippingProviderResolver(
  adapters: readonly ShippingProviderAdapter[],
): ShippingProviderResolver {
  const map = new Map<string, ShippingProviderAdapter>();
  for (const adapter of adapters) {
    const id = adapter.id.trim().toLowerCase();
    if (!id || map.has(id)) throw new Error("Duplicate Shipping provider adapter.");
    map.set(id, adapter);
  }

  return {
    resolve(providerId: string) {
      return map.get(providerId.trim().toLowerCase());
    },
  };
}
