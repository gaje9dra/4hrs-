import type { StorefrontProductDetail } from "@/lib/storefront/catalog";

export type StorefrontVariantSelection = Record<string, string>;

type StorefrontVariant = StorefrontProductDetail["variants"][number];

export function getVariantOptionValueId(variant: StorefrontVariant, optionTypeId: string) {
  return variant.optionValues.find((item) => item.optionType.id === optionTypeId)?.id;
}

export function matchesVariantSelection(
  product: StorefrontProductDetail,
  variant: StorefrontVariant,
  selection: StorefrontVariantSelection,
) {
  return product.options.every(
    (option) => getVariantOptionValueId(variant, option.id) === selection[option.id],
  );
}

export function resolveSelectedVariant(
  product: StorefrontProductDetail,
  selection: StorefrontVariantSelection,
) {
  if (product.options.some((option) => !selection[option.id])) return null;
  return product.variants.find((variant) => matchesVariantSelection(product, variant, selection)) ?? null;
}

export function isVariantValueSelectable(
  product: StorefrontProductDetail,
  selection: StorefrontVariantSelection,
  optionTypeId: string,
  valueId: string,
) {
  const option = product.options.find((item) => item.id === optionTypeId);
  if (!option || !option.values.some((value) => value.id === valueId)) return false;

  const next = { ...selection, [optionTypeId]: valueId };
  return product.variants.some(
    (variant) =>
      Object.entries(next).every(
        ([selectedOptionTypeId, selectedValueId]) =>
          getVariantOptionValueId(variant, selectedOptionTypeId) === selectedValueId,
      ) && variant.availability.state !== "OUT_OF_STOCK",
  );
}

export function getDeterministicInitialVariant(product: StorefrontProductDetail) {
  return (
    product.variants.find(
      (variant) =>
        variant.availability.state === "IN_STOCK" ||
        variant.availability.state === "LOW_STOCK" ||
        variant.availability.state === "UNTRACKED",
    ) ?? product.variants[0] ?? null
  );
}

export function selectionFromVariant(
  product: StorefrontProductDetail,
  variant: StorefrontVariant | null,
): StorefrontVariantSelection {
  if (!variant) return {};
  return Object.fromEntries(
    product.options
      .map((option) => [option.id, getVariantOptionValueId(variant, option.id)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
