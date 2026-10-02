import { Prisma } from "@prisma/client";
import { createFulfillmentProviderMappingRepository, toFulfillmentProviderMappingDto } from "@/lib/fulfillment/mapping";

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function normalizeProviderId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!PROVIDER_ID_PATTERN.test(normalized)) throw new Error("Provider identifier is invalid.");
  return normalized;
}

export function validateProviderMappingInput(input: {
  providerId: string;
  providerSku: string;
  providerVariantReference?: string | null;
}): void {
  normalizeProviderId(input.providerId);
  const sku = input.providerSku.trim();
  if (!sku || sku.length > 120) throw new Error("Provider SKU is invalid.");
  if (input.providerVariantReference?.trim().length && input.providerVariantReference.trim().length > 255) {
    throw new Error("Provider variant reference is invalid.");
  }
}

export function createProviderMappingService() {
  const repository = createFulfillmentProviderMappingRepository();

  return {
    async getVariantMappings(variantId: string) {
      return (await repository.getByVariant(variantId)).map(toFulfillmentProviderMappingDto);
    },
    async getVariantMapping(variantId: string, providerId: string) {
      const normalizedProvider = normalizeProviderId(providerId);
      const mapping = await repository.getByVariantAndProvider(variantId, normalizedProvider);
      return mapping ? toFulfillmentProviderMappingDto(mapping) : null;
    },
    async saveVariantMapping(input: {
      variantId: string;
      providerId: string;
      providerSku: string;
      providerVariantReference?: string | null;
      active?: boolean;
    }) {
      validateProviderMappingInput(input);
      try {
        const mapping = await repository.upsert({ ...input, providerId: normalizeProviderId(input.providerId) });
        return toFulfillmentProviderMappingDto(mapping);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new Error("Provider mapping conflicts with an existing variant/provider or provider SKU mapping.");
        }
        throw error;
      }
    },
    async removeVariantMapping(variantId: string, providerId: string) {
      const normalizedProvider = normalizeProviderId(providerId);
      const variant = await repository.getVariantPublicationState(variantId);
      if (!variant) throw new Error("ProductVariant was not found.");
      if (variant.product.status === "ACTIVE") {
        throw new Error("Cannot remove a fulfillment mapping from a published ProductVariant.");
      }
      return repository.deleteByVariantAndProvider(variantId, normalizedProvider);
    },
  };
}
