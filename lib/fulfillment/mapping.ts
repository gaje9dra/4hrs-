import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export type ProviderMappingClient = PrismaClient | Prisma.TransactionClient;

export type FulfillmentProviderMappingDto = Readonly<{
  id: string;
  variantId: string;
  providerId: string;
  providerSku: string;
  providerVariantReference: string | null;
  active: boolean;
}>;

function normalize(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(field + " is required.");
  return normalized.toLowerCase();
}

function normalizeSku(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) throw new Error("providerSku is invalid.");
  return normalized;
}

function normalizeReference(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

export function createFulfillmentProviderMappingRepository(client?: ProviderMappingClient) {
  const database = client ?? db;
  return {
    getByVariantAndProvider(variantId: string, providerId: string) {
      return database.fulfillmentProviderMapping.findUnique({
        where: { variantId_providerId: { variantId, providerId: normalize(providerId, "providerId") } },
      });
    },
    getByVariant(variantId: string) {
      return database.fulfillmentProviderMapping.findMany({
        where: { variantId },
        orderBy: { providerId: "asc" },
      });
    },
    getByProviderSku(providerId: string, providerSku: string) {
      return database.fulfillmentProviderMapping.findUnique({
        where: { providerId_providerSku: { providerId: normalize(providerId, "providerId"), providerSku: normalizeSku(providerSku) } },
      });
    },
    getVariantPublicationState(variantId: string) {
      return database.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, product: { select: { status: true } } },
      });
    },
    async upsert(input: {
      variantId: string;
      providerId: string;
      providerSku: string;
      providerVariantReference?: string | null;
      active?: boolean;
    }) {
      const providerId = normalize(input.providerId, "providerId");
      const providerSku = normalizeSku(input.providerSku);
      return database.fulfillmentProviderMapping.upsert({
        where: { variantId_providerId: { variantId: input.variantId, providerId } },
        create: {
          variantId: input.variantId,
          providerId,
          providerSku,
          providerVariantReference: normalizeReference(input.providerVariantReference),
          active: input.active ?? true,
        },
        update: {
          providerSku,
          providerVariantReference: normalizeReference(input.providerVariantReference),
          active: input.active ?? true,
        },
      });
    },
    async deleteByVariantAndProvider(variantId: string, providerId: string) {
      return database.fulfillmentProviderMapping.delete({
        where: { variantId_providerId: { variantId, providerId: normalize(providerId, "providerId") } },
      });
    },
  };
}

export type FulfillmentProviderMappingRepository = ReturnType<typeof createFulfillmentProviderMappingRepository>;

export function toFulfillmentProviderMappingDto(mapping: {
  id: string;
  variantId: string;
  providerId: string;
  providerSku: string;
  providerVariantReference: string | null;
  active: boolean;
}): FulfillmentProviderMappingDto {
  return {
    id: mapping.id,
    variantId: mapping.variantId,
    providerId: mapping.providerId,
    providerSku: mapping.providerSku,
    providerVariantReference: mapping.providerVariantReference,
    active: mapping.active,
  };
}

export function mapProviderMappingDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new Error("Provider mapping conflicts with an existing variant/provider or provider SKU mapping.");
  }
  throw error;
}
