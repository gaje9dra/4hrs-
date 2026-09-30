'use client';

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCatalogMoney } from "@/lib/storefront/money";
import {
  buildPurchaseSelection,
  getDeterministicInitialVariant,
  getPurchaseIntentState,
  isVariantValueSelectable,
  resolveSelectedVariant,
  selectionFromVariant,
  type StorefrontVariantSelection,
} from "@/lib/storefront/variant-selection";
import type { StorefrontProductDetail } from "@/lib/storefront/catalog";

const availabilityLabel = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Limited availability",
  OUT_OF_STOCK: "Out of stock",
  UNTRACKED: "Available",
} as const;

export function ProductOptions({
  product,
  onMediaChange,
}: {
  product: StorefrontProductDetail;
  onMediaChange?: (media: StorefrontProductDetail["media"]) => void;
}) {
  const [selection, setSelection] = useState<StorefrontVariantSelection>(() =>
    selectionFromVariant(product, getDeterministicInitialVariant(product)),
  );

  const selectedVariant = useMemo(
    () => resolveSelectedVariant(product, selection),
    [product, selection],
  );

  const effectivePrice = selectedVariant?.price ?? product.price;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const availability = selectedVariant?.availability ?? product.availability;
  const purchaseIntentState = getPurchaseIntentState(product, selection);
  const purchaseSelection = buildPurchaseSelection(product, selection);

  function selectValue(optionTypeId: string, valueId: string) {
    if (!isVariantValueSelectable(product, selection, optionTypeId, valueId)) return;
    const next = { ...selection, [optionTypeId]: valueId };
    const variant = resolveSelectedVariant(product, next);
    if (!variant) return;

    setSelection(next);
    onMediaChange?.(variant.media.length ? variant.media : product.media);
  }

  return (
    <div className="grid gap-6">
      {product.options.map((option) => (
        <fieldset key={option.id} className="grid gap-3">
          <legend className="text-base font-900 uppercase">{option.name}</legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const selected = selection[option.id] === value.id;
              const selectable = isVariantValueSelectable(product, selection, option.id, value.id);
              return (
                <button
                  key={value.id}
                  type="button"
                  aria-pressed={selected}
                  aria-disabled={!selectable}
                  disabled={!selectable}
                  onClick={() => selectValue(option.id, value.id)}
                  className={[
                    "min-h-11 border-2 border-border px-4 py-2 text-sm font-800 uppercase",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue",
                    selected ? "bg-primary-blue text-white" : "bg-white",
                    selectable ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-40 line-through",
                    "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  ].join(" ")}
                >
                  {value.displayName}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="border-t-2 border-border pt-5 lg:border-t-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-2xl font-900">{formatCatalogMoney(effectivePrice, product.currency)}</span>
          {compareAtPrice ? <span className="text-sm line-through">{formatCatalogMoney(compareAtPrice, product.currency)}</span> : null}
        </div>
        <div className="mt-3">
          <Badge variant={availability.state === "OUT_OF_STOCK" ? "outline" : "yellow"}>
            {availabilityLabel[availability.state]}
          </Badge>
        </div>
        {selectedVariant && availability.state === "OUT_OF_STOCK" ? (
          <p className="mt-3 text-sm font-800 uppercase">This option combination is currently unavailable.</p>
        ) : null}
      </div>

      <div className="border-2 border-border bg-primary-red p-5 text-white shadow-hard-md lg:border-4 lg:shadow-hard-lg" aria-label="Purchase intent">
        <p className="text-xs font-900 uppercase tracking-[.2em]">Purchase intent</p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-describedby="purchase-intent-status"
          className="mt-3 min-h-12 w-full border-2 border-white bg-white px-5 py-3 text-base font-900 uppercase text-primary-red opacity-100"
        >
          {purchaseIntentState === "READY"
  ? "Ready for cart"
  : purchaseIntentState === "MISSING_REQUIRED_SELECTION"
    ? "Select options"
    : purchaseIntentState === "INVALID_SELECTION"
      ? "Invalid selection"
      : "Unavailable"}
        </button>
        <p id="purchase-intent-status" className="mt-3 text-sm font-700">
          {purchaseIntentState === "MISSING_REQUIRED_SELECTION"
            ? "Select every required option before continuing."
            : purchaseIntentState === "INVALID_SELECTION"
              ? "The selected option combination is not valid."
              : purchaseIntentState === "UNAVAILABLE"
                ? "This option combination is currently unavailable."
                : "The selection is validated. Cart integration is intentionally deferred."}
        </p>
        {purchaseSelection ? (
          <p className="sr-only">
            Valid selection for product {purchaseSelection.productId} and variant {purchaseSelection.variantId}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
