import type { StorefrontProductDetail } from "@/lib/storefront/catalog";

export type StorefrontVariantSelection = Record<string, string>;

export type PurchaseSelection = {
  productId: string;
  variantId: string;
  quantity: number;
};

export type PurchaseIntentState =
  | "PRODUCT_UNAVAILABLE"
  | "MISSING_REQUIRED_SELECTION"
  | "INVALID_SELECTION"
  | "UNAVAILABLE"
  | "READY";

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
  const optionIds = new Set(product.options.map((option) => option.id));
  const selectionEntries = Object.entries(selection);

  if (
    selectionEntries.some(
      ([optionTypeId, valueId]) =>
        !optionIds.has(optionTypeId) || typeof valueId !== "string" || valueId.length === 0,
    )
  ) {
    return null;
  }

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


export function getPurchaseIntentState(
  product: StorefrontProductDetail,
  selection: StorefrontVariantSelection,
): PurchaseIntentState {
  if (product.availability.state === "OUT_OF_STOCK") return "PRODUCT_UNAVAILABLE";
  if (product.options.some((option) => !selection[option.id])) return "MISSING_REQUIRED_SELECTION";

  const variant = resolveSelectedVariant(product, selection);
  if (!variant) return "INVALID_SELECTION";

  return variant.availability.state === "OUT_OF_STOCK" ? "UNAVAILABLE" : "READY";
}

export function buildPurchaseSelection(
  product: StorefrontProductDetail,
  selection: StorefrontVariantSelection,
): PurchaseSelection | null {
  if (getPurchaseIntentState(product, selection) !== "READY") return null;

  const variant = resolveSelectedVariant(product, selection);
  return variant ? { productId: product.id, variantId: variant.id, quantity: 1 } : null;
}
