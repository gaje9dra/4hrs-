import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
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

function auditState(mapping: {
  id: string;
  variantId: string;
  providerId: string;
  providerSku: string;
  providerVariantReference: string | null;
  active: boolean;
} | null) {
  return mapping
    ? {
        id: mapping.id,
        variantId: mapping.variantId,
        providerId: mapping.providerId,
        providerSku: mapping.providerSku,
        providerVariantReference: mapping.providerVariantReference,
        active: mapping.active,
      }
    : null;
}

async function writeMappingAudit(
  client: Prisma.TransactionClient,
  input: {
    variantId: string;
    operation: "CREATE" | "UPDATE" | "DELETE";
    actorId?: string | null;
    beforeState: ReturnType<typeof auditState>;
    afterState: ReturnType<typeof auditState>;
  },
) {
  await client.catalogAuditEvent.create({
    data: {
      entityType: "VARIANT",
      entityId: input.variantId,
      operation: input.operation,
      source: "MANUAL",
      actorType: input.actorId ? "USER" : "PROCESS",
      actorId: input.actorId ?? null,
      changedFields: ["providerMapping"],
      beforeState: input.beforeState ?? undefined,
      afterState: input.afterState ?? undefined,
      metadata: { domain: "fulfillment-provider-mapping" },
    },
  });
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
      auditActorId?: string | null;
    }) {
      validateProviderMappingInput(input);
      const providerId = normalizeProviderId(input.providerId);
      try {
        const mapping = await db.$transaction(async (tx) => {
          const txRepository = createFulfillmentProviderMappingRepository(tx);
          const variant = await txRepository.getVariantPublicationState(input.variantId);
          if (!variant) throw new Error("ProductVariant was not found.");
          if (variant.product.status === "ACTIVE" && input.active === false) {
            throw new Error("Cannot deactivate a fulfillment mapping for a published ProductVariant.");
          }
          const before = await txRepository.getByVariantAndProvider(input.variantId, providerId);
          const saved = await txRepository.upsert({ ...input, providerId });
          await writeMappingAudit(tx, {
            variantId: input.variantId,
            operation: before ? "UPDATE" : "CREATE",
            actorId: input.auditActorId,
            beforeState: auditState(before),
            afterState: auditState(saved),
          });
          return saved;
        });
        return toFulfillmentProviderMappingDto(mapping);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new Error("Provider mapping conflicts with an existing variant/provider or provider SKU mapping.");
        }
        throw error;
      }
    },
    async removeVariantMapping(variantId: string, providerId: string, auditActorId?: string | null) {
      const normalizedProvider = normalizeProviderId(providerId);
      try {
        await db.$transaction(async (tx) => {
          const txRepository = createFulfillmentProviderMappingRepository(tx);
          const variant = await txRepository.getVariantPublicationState(variantId);
          if (!variant) throw new Error("ProductVariant was not found.");
          if (variant.product.status === "ACTIVE") {
            throw new Error("Cannot remove a fulfillment mapping from a published ProductVariant.");
          }
          const before = await txRepository.getByVariantAndProvider(variantId, normalizedProvider);
          const deleted = await txRepository.deleteByVariantAndProvider(variantId, normalizedProvider);
          await writeMappingAudit(tx, {
            variantId,
            operation: "DELETE",
            actorId: auditActorId,
            beforeState: auditState(before),
            afterState: null,
          });
          return deleted;
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          throw new Error("Provider mapping was not found.");
        }
        throw error;
      }
    },
  };
}
