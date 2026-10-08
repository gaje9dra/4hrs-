"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type CartMutationError = Error & { code?: string };

async function addToCart(selection: { productId: string; variantId: string; quantity: number }) {
  const response = await fetch("/api/cart", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  });
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | unknown;
  if (!response.ok) {
    const errorBody = body && typeof body === "object" && body !== null && "error" in body
      ? (body as { error?: { code?: string; message?: string } }).error
      : undefined;
    const error = new Error(errorBody?.message ?? "Could not add this item to Cart.") as CartMutationError;
    error.code = errorBody?.code;
    throw error;
  }
  return body;
}

export function ProductOptions({
  product,
  purchaseIntent,
  onMediaChange,
}: {
  product: StorefrontProductDetail;
  purchaseIntent?: "buy" | "cart";
  onMediaChange?: (media: StorefrontProductDetail["media"]) => void;
}) {
  const [selection, setSelection] = useState<StorefrontVariantSelection>(() =>
    selectionFromVariant(product, getDeterministicInitialVariant(product)),
  );
  const [addState, setAddState] = useState<AddState>("idle");
  const [addError, setAddError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const addRequest = useRef(0);
  const intentStarted = useRef(false);
  const router = useRouter();

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
    setAuthRequired(false);
    onMediaChange?.(variant.media.length ? variant.media : product.media);
  }

  async function handleAdd(buyNow = false) {
    if (!purchaseSelection || addState === "pending") return;
    const requestId = ++addRequest.current;
    setAddState("pending");
    setAddError(null);
    setAuthRequired(false);
    try {
      await addToCart(purchaseSelection);
      if (requestId !== addRequest.current) return;
      setAddState("success");
      if (buyNow || purchaseIntent === "buy") {
        router.push("/checkout");
      }
    } catch (error) {
      if (requestId !== addRequest.current) return;
      setAddState("error");
      const mutationError = error as CartMutationError;
      setAuthRequired(mutationError.code === "CART_UNAUTHORIZED");
      setAddError(mutationError.message || "Could not add this item to Cart.");
    }
  }

  useEffect(() => {
    if (!purchaseIntent || intentStarted.current || !purchaseSelection) return;
    intentStarted.current = true;
    void handleAdd(purchaseIntent === "buy");
  }, [purchaseIntent, purchaseSelection]);

  return (
    <div className="grid gap-6">
      {(() => {
        const sizeOption = product.options.find((option) => option.name.trim().toLowerCase() === "size");
        const otherOptions = product.options.filter((option) => option !== sizeOption);
        const renderOption = (option: (typeof product.options)[number], isSize = false) => {
          const selectedValue = option.values.find((value) => selection[option.id] === value.id);
          return (
            <fieldset key={option.id} className="grid gap-3">
              <legend className="flex flex-wrap items-center justify-between gap-3 text-sm font-900 uppercase">
                <span>{isSize ? "SIZE" : option.name}: {selectedValue?.displayName ?? "Select"}</span>
                {isSize ? <span className="text-xs font-700 tracking-[0.08em] text-muted-foreground">Choose your fit</span> : null}
              </legend>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const selected = selection[option.id] === value.id;
                  const selectable = isVariantValueSelectable(product, selection, option.id, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-label={isSize ? `Size ${value.displayName}` : value.displayName}
                      aria-pressed={selected}
                      aria-disabled={!selectable}
                      disabled={!selectable}
                      onClick={() => selectValue(option.id, value.id)}
                      className={[
                        isSize
                          ? "h-14 min-w-14 border-2 border-border px-3 py-2 text-sm font-900 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue"
                          : "min-h-11 border-2 border-border px-4 py-2 text-sm font-800 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue",
                        selected ? "bg-primary-blue text-white shadow-hard-sm" : "bg-white",
                        selectable ? "hover:-translate-y-0.5" : "cursor-not-allowed bg-[linear-gradient(to_bottom_right,transparent_48%,#121212_49%,#121212_51%,transparent_52%)] opacity-45 line-through",
                        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                      ].join(" ")}
                    >
                      {value.displayName}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        };
        return (
          <>
            {sizeOption ? renderOption(sizeOption, true) : null}
            {otherOptions.map((option) => renderOption(option))}
          </>
        );
      })()}

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
        <Button variant="yellow" loading={addState === "pending"} disabled={!purchaseSelection || purchaseIntentState !== "READY"} onClick={() => void handleAdd(true)} className="mt-3 w-full">Buy now</Button>
        <p id="purchase-intent-status" className="mt-3 text-sm font-700" aria-live="polite">
          {purchaseIntentState === "PRODUCT_UNAVAILABLE" ? "This product is currently unavailable."
            : purchaseIntentState === "MISSING_REQUIRED_SELECTION" ? "Select every required option before adding to Cart."
              : purchaseIntentState === "INVALID_SELECTION" ? "The selected option combination is not valid."
                : purchaseIntentState === "UNAVAILABLE" ? "This option combination is currently unavailable."
                  : addState === "success" ? "The server confirmed this Cart mutation." : "Selection is ready to add to Cart."}
        </p>
        {addError ? (
          <div className="mt-4 grid gap-3">
            <Alert variant="error" title={authRequired ? "Sign in required" : "Could not add to Cart"}>{addError}</Alert>
            {authRequired ? (
              <Link
                href="/login?next=%2Fcart"
                className="inline-flex min-h-12 items-center justify-center border-2 border-border bg-primary-yellow px-4 py-3 text-sm font-900 uppercase text-foreground no-underline shadow-hard-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-red"
              >
                Sign in to continue
              </Link>
            ) : null}
          </div>
        ) : null}
        {addState === "success" ? <div className="mt-4"><Button href="/cart" variant="yellow" className="w-full">View cart</Button></div> : null}
      </div>
    </div>
  );
}
