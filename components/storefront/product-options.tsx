'use client';

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCatalogMoney } from "@/lib/storefront/money";
import type { StorefrontProductDetail } from "@/lib/storefront/catalog";

const availabilityLabel = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Limited availability",
  OUT_OF_STOCK: "Out of stock",
  UNTRACKED: "Available",
} as const;

type Selection = Record<string, string>;

function optionValueId(variant: StorefrontProductDetail["variants"][number], optionTypeId: string) {
  return variant.optionValues.find((item) => item.optionType.id === optionTypeId)?.id;
}

function matchesSelection(variant: StorefrontProductDetail["variants"][number], selection: Selection) {
  return Object.entries(selection).every(([optionTypeId, valueId]) => optionValueId(variant, optionTypeId) === valueId);
}

function isSelectable(product: StorefrontProductDetail, selection: Selection, optionTypeId: string, valueId: string) {
  const next = { ...selection, [optionTypeId]: valueId };
  return product.variants.some((variant) => matchesSelection(variant, next) && variant.availability.state !== "OUT_OF_STOCK");
}

function initialSelection(product: StorefrontProductDetail): Selection {
  const variant = product.variants.find((item) =>
    item.availability.state === "IN_STOCK" ||
    item.availability.state === "LOW_STOCK" ||
    item.availability.state === "UNTRACKED",
  ) ?? product.variants[0];

  if (!variant) return {};
  return Object.fromEntries(
    product.options
      .map((option) => [option.id, optionValueId(variant, option.id)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export function ProductOptions({
  product,
  onMediaChange,
}: {
  product: StorefrontProductDetail;
  onMediaChange?: (media: StorefrontProductDetail["media"]) => void;
}) {
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product));

  const selectedVariant = useMemo(
    () => product.variants.find((variant) =>
      product.options.every((option) => optionValueId(variant, option.id) === selection[option.id]),
    ) ?? null,
    [product.options, product.variants, selection],
  );

  const effectivePrice = selectedVariant?.price ?? product.price;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const availability = selectedVariant?.availability ?? product.availability;

  function selectValue(optionTypeId: string, valueId: string) {
    if (!isSelectable(product, selection, optionTypeId, valueId)) return;
    const next = { ...selection, [optionTypeId]: valueId };
    setSelection(next);

    const variant = product.variants.find((item) =>
      product.options.every((option) => optionValueId(item, option.id) === next[option.id]),
    );
    if (variant) onMediaChange?.(variant.media.length ? variant.media : product.media);
  }

  return (
    <div className="grid gap-6">
      {product.options.map((option) => (
        <fieldset key={option.id} className="grid gap-3">
          <legend className="text-base font-900 uppercase">{option.name}</legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const selected = selection[option.id] === value.id;
              const selectable = isSelectable(product, selection, option.id, value.id);
              return (
                <button
                  key={value.id}
                  type="button"
                  aria-pressed={selected}
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

      <div className="border-2 border-border bg-primary-red p-5 text-white shadow-hard-md lg:border-4 lg:shadow-hard-lg" aria-label="Future commerce action area">
        <p className="font-900 uppercase">Purchase actions coming soon</p>
        <p className="mt-2 text-sm">Product selection is available now. Cart and checkout are intentionally deferred.</p>
      </div>
    </div>
  );
}
