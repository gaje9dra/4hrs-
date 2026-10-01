import type { FulfillmentProviderAdapter, FulfillmentProviderRegistry, FulfillmentProviderResolver } from "@/lib/fulfillment/provider";
import { assertPrivateFulfillmentConfiguration, loadFulfillmentProviderConfiguration, type FulfillmentProviderConfiguration } from "@/lib/fulfillment/config";
import { qikinkFulfillmentProvider } from "@/lib/fulfillment/providers/qikink";

export type FulfillmentProviderResolverDependencies = {
  registry: FulfillmentProviderRegistry;
  configuration?: FulfillmentProviderConfiguration | null;
};

export function createFulfillmentProviderRegistry(adapters: readonly FulfillmentProviderAdapter[]): FulfillmentProviderRegistry {
  const map = new Map<string, FulfillmentProviderAdapter>();
  for (const adapter of adapters) {
    const id = adapter.id.trim().toLowerCase();
    if (!id || map.has(id)) throw new Error("Duplicate fulfillment provider adapter.");
    map.set(id, adapter);
  }
  return {
    get(providerId) {
      return map.get(providerId.trim().toLowerCase());
    },
  };
}

export function createFulfillmentProviderResolver(
  dependencies: FulfillmentProviderResolverDependencies,
): FulfillmentProviderResolver {
  const configuration = dependencies.configuration === undefined
    ? loadFulfillmentProviderConfiguration()
    : dependencies.configuration;
  if (configuration) assertPrivateFulfillmentConfiguration(configuration);
  return {
    resolve() {
      if (!configuration?.enabled) return undefined;
      return dependencies.registry.get(configuration.id);
    },
  };
}

export function createConfiguredFulfillmentProviderRegistry(): FulfillmentProviderRegistry {
  return createFulfillmentProviderRegistry([qikinkFulfillmentProvider]);
}

export function assertSupportedFulfillmentProvider(
  registry: FulfillmentProviderRegistry,
  providerId: string,
): FulfillmentProviderAdapter {
  const adapter = registry.get(providerId);
  if (!adapter) throw new Error("Fulfillment provider is unsupported.");
  return adapter;
}
