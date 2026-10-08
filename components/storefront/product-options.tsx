"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Ruler, ShoppingBag } from "lucide-react";
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
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
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
    if (!sizeChartOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSizeChartOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sizeChartOpen]);

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
            <fieldset
              key={option.id}
              className={isSize
                ? "grid gap-4 border-2 border-border bg-white p-4 shadow-[3px_3px_0_0_rgba(18,18,18,0.08)] sm:p-5"
                : "grid gap-3"}
            >
              <legend className="sr-only">{isSize ? "Size" : option.name}</legend>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-900 uppercase tracking-[0.08em]">{isSize ? "Select size" : option.name}</span>
                    {isSize && selectedValue ? (
                      <span className="inline-flex items-center rounded-full bg-primary-blue px-2.5 py-1 text-[11px] font-900 uppercase tracking-[0.08em] text-white">
                        {selectedValue.displayName} selected
                      </span>
                    ) : null}
                  </div>
                  {isSize ? (
                    <p className="mt-1 text-xs font-600 text-muted-foreground">Choose the size that fits you best.</p>
                  ) : null}
                </div>
                {isSize ? (
                  <button
                    type="button"
                    onClick={() => setSizeChartOpen(true)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-md border-2 border-border bg-primary-yellow px-3.5 py-2.5 text-[11px] font-900 uppercase tracking-[0.08em] text-foreground shadow-[2px_2px_0_0_rgba(18,18,18,0.12)] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-white hover:shadow-hard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue"
                    aria-haspopup="dialog"
                  >
                    <Ruler size={14} strokeWidth={3} aria-hidden="true" />
                    Size guide
                  </button>
                ) : null}
              </div>
              <div className={isSize ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6" : "flex flex-wrap gap-2"}>
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
                          ? "flex h-12 items-center justify-center rounded-md border-2 border-border px-3 text-sm font-900 uppercase tracking-[0.04em] transition-[transform,box-shadow,background-color,color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue"
                          : "min-h-11 border-2 border-border px-4 py-2 text-sm font-800 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue",
                        selected
                          ? "border-primary-blue bg-primary-blue text-white shadow-[3px_3px_0_0_rgba(18,18,18,0.18)]"
                          : "bg-white text-foreground hover:-translate-y-0.5 hover:border-primary-blue hover:bg-primary-yellow/20 hover:shadow-[2px_2px_0_0_rgba(18,18,18,0.1)]",
                        selectable ? "" : "cursor-not-allowed bg-[linear-gradient(to_bottom_right,transparent_48%,#121212_49%,#121212_51%,transparent_52%)] opacity-40 line-through shadow-none hover:translate-y-0 hover:border-border hover:bg-white",
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

      {sizeChartOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSizeChartOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-chart-title"
            className="relative max-h-[90vh] w-full max-w-3xl overflow-auto border-4 border-border bg-[#f7f3ec] p-5 text-foreground shadow-hard-lg sm:p-8"
          >
            <button
              type="button"
              onClick={() => setSizeChartOpen(false)}
              aria-label="Close size chart"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border-2 border-border bg-white text-xl font-900 leading-none hover:bg-primary-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue"
            >
              ×
            </button>
            <div className="pr-12">
              <h2 id="size-chart-title" className="text-3xl font-900 uppercase leading-none sm:text-5xl">
                ACID WASHED
                <br />
                OVERSIZED TEE
              </h2>
              <div className="mt-6 rounded-full border-2 border-border px-5 py-3 text-center text-xl font-900 uppercase">
                SIZE CHART
              </div>
            </div>
            <div className="mt-8 overflow-hidden border-2 border-border">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="bg-[#edb8a8] text-sm font-900 uppercase sm:text-lg">
                    <th className="border-r-2 border-border px-3 py-3">Size</th>
                    <th className="border-r-2 border-border px-3 py-3">Chest</th>
                    <th className="px-3 py-3">Length</th>
                  </tr>
                </thead>
                <tbody className="text-base font-700 sm:text-lg">
                  {[
                    ["XS", "39", "27"],
                    ["S", "41", "28"],
                    ["M", "43", "29"],
                    ["L", "45", "30"],
                    ["XL", "47", "31"],
                    ["2XL", "49", "32"],
                  ].map(([size, chest, length]) => (
                    <tr key={size}>
                      <td className="border-t-2 border-r-2 border-border bg-[#ddd7d1] px-3 py-3 font-900">{size}</td>
                      <td className="border-t-2 border-r-2 border-border bg-[#eee7dc] px-3 py-3">{chest}</td>
                      <td className="border-t-2 border-border bg-[#eee7dc] px-3 py-3">{length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-right text-xs font-700">*All measurements are in inches.</p>
          </section>
        </div>
      ) : null}

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
