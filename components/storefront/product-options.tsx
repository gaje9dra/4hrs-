"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

type AddState = "idle" | "pending" | "success" | "error";

async function addToCart(selection: { productId: string; variantId: string; quantity: number }) {
  const response = await fetch("/api/cart", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  });
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | unknown;
  if (!response.ok) {
    const message = body && typeof body === "object" && body !== null && "error" in body
      ? ((body as { error?: { message?: string } }).error?.message ?? "Could not add this item to Cart.")
      : "Could not add this item to Cart.";
    throw new Error(message);
  }
  return body;
}

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
  const [addState, setAddState] = useState<AddState>("idle");
  const [addError, setAddError] = useState<string | null>(null);
  const addRequest = useRef(0);

  const selectedVariant = useMemo(() => resolveSelectedVariant(product, selection), [product, selection]);
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
    setAddState("idle");
    setAddError(null);
    onMediaChange?.(variant.media.length ? variant.media : product.media);
  }

  async function handleAdd() {
    if (!purchaseSelection || addState === "pending") return;
    const requestId = ++addRequest.current;
    setAddState("pending");
    setAddError(null);
    try {
      await addToCart(purchaseSelection);
      if (requestId !== addRequest.current) return;
      setAddState("success");
    } catch (error) {
      if (requestId !== addRequest.current) return;
      setAddState("error");
      setAddError(error instanceof Error ? error.message : "Could not add this item to Cart.");
    }
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
                <button key={value.id} type="button" aria-pressed={selected} aria-disabled={!selectable} disabled={!selectable} onClick={() => selectValue(option.id, value.id)} className={["min-h-11 border-2 border-border px-4 py-2 text-sm font-800 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue", selected ? "bg-primary-blue text-white" : "bg-white", selectable ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-40 line-through", "motion-reduce:transition-none motion-reduce:hover:translate-y-0"].join(" ")}>{value.displayName}</button>
            })}
          </div>
        </fieldset>
      ))}

      <div className="border-t-2 border-border pt-5 lg:border-t-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-2xl font-900">{formatCatalogMoney(effectivePrice, product.currency)}</span>
          {compareAtPrice ? <span className="text-sm line-through">{formatCatalogMoney(compareAtPrice, product.currency)}</span> : null}
        </div>
        <div className="mt-3"><Badge variant={availability.state === "OUT_OF_STOCK" ? "outline" : "yellow"}>{availabilityLabel[availability.state]}</Badge></div>
        {selectedVariant && availability.state === "OUT_OF_STOCK" ? <p className="mt-3 text-sm font-800 uppercase">This option combination is currently unavailable.</p> : null}
      </div>

      <div className="border-2 border-border bg-primary-red p-5 text-white shadow-hard-md lg:border-4 lg:shadow-hard-lg" aria-label="Add to Cart">
        <div className="flex items-center gap-3"><ShoppingBag size={22} strokeWidth={3} aria-hidden="true" /><p className="text-xs font-900 uppercase tracking-[.2em]">Cart</p></div>
        <Button variant="yellow" loading={addState === "pending"} disabled={!purchaseSelection || purchaseIntentState !== "READY"} onClick={() => void handleAdd()} className="mt-3 w-full">
          {addState === "success" ? <><Check size={18} aria-hidden="true" />Added to cart</> : "Add to cart"}
        </Button>
        <p id="purchase-intent-status" className="mt-3 text-sm font-700" aria-live="polite">
          {purchaseIntentState === "PRODUCT_UNAVAILABLE" ? "This product is currently unavailable."
            : purchaseIntentState === "MISSING_REQUIRED_SELECTION" ? "Select every required option before adding to Cart."
              : purchaseIntentState === "INVALID_SELECTION" ? "The selected option combination is not valid."
                : purchaseIntentState === "UNAVAILABLE" ? "This option combination is currently unavailable."
                  : addState === "success" ? "The server confirmed this Cart mutation." : "Selection is ready to add to Cart."}
        </p>
        {addError ? <Alert variant="error" title="Could not add to Cart" className="mt-4">{addError}</Alert> : null}
        {addState === "success" ? <div className="mt-4"><Button href="/cart" variant="yellow" className="w-full">View cart</Button></div> : null}
      </div>
    </div>
  );
}
