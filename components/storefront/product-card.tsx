"use client";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Check, Heart, ShoppingCart, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { StorefrontProductCard } from "@/lib/storefront/catalog";
import { productPath } from "@/lib/catalog/routes";
import { formatCatalogMoney } from "@/lib/storefront/money";

type QuickAddData = {
  id: string;
  title: string;
  options: Array<{ id: string; name: string; values: Array<{ id: string; displayName: string }> }>;
  variants: Array<{
    id: string;
    displayName: string | null;
    size: string | null;
    color: string | null;
    availability: { state: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED" };
    optionValues: Array<{ id: string; optionType: { id: string } }>;
  }>;
};

function savingsPercent(product: StorefrontProductCard): number | null {
  if (!product.compareAtPrice) return null;
  const current = Number(product.price);
  const compareAt = Number(product.compareAtPrice);
  if (!Number.isFinite(current) || !Number.isFinite(compareAt) || compareAt <= current || compareAt <= 0) return null;
  return Math.round(((compareAt - current) / compareAt) * 100);
}

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  const href = productPath(product);
  const unavailable = product.availability === "OUT_OF_STOCK";
  const savings = savingsPercent(product);
  const gallery = product.images?.length ? product.images : product.image ? [product.image] : [];
  const primaryImage = product.image ?? gallery[0] ?? null;
  const alternateImages = gallery.filter((image) => image.url !== primaryImage?.url);
  const [hoverImageIndex, setHoverImageIndex] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddData, setQuickAddData] = useState<QuickAddData | null>(null);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [cartState, setCartState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [cartMessage, setCartMessage] = useState("");
  const nextAlternateIndex = useRef(0);
  const handleImageEnter = () => {
    if (alternateImages.length === 0) return;
    const nextIndex = nextAlternateIndex.current % alternateImages.length;
    setHoverImageIndex(nextIndex + 1);
    nextAlternateIndex.current = (nextIndex + 1) % alternateImages.length;
  };
  const handleImageLeave = () => setHoverImageIndex(0);
  const activeImage = hoverImageIndex > 0 ? alternateImages[hoverImageIndex - 1] : primaryImage;

  const selectedVariant = useMemo(() => {
    if (!quickAddData) return null;
    if (quickAddData.options.length === 0) return quickAddData.variants.find((variant) => variant.availability.state !== "OUT_OF_STOCK") ?? quickAddData.variants[0] ?? null;
    if (!quickAddData.options.every((option) => selectedValues[option.id])) return null;
    return quickAddData.variants.find((variant) =>
      quickAddData.options.every((option) =>
        variant.optionValues.some((value) => value.optionType.id === option.id && value.id === selectedValues[option.id]),
      ),
    ) ?? null;
  }, [quickAddData, selectedValues]);

  async function openQuickAdd() {
    if (unavailable || quickAddLoading) return;
    setQuickAddOpen(true);
    setCartState("idle");
    setCartMessage("");
    if (quickAddData) return;
    setQuickAddLoading(true);
    try {
      const response = await fetch(`/api/storefront/products/${encodeURIComponent(product.slug)}/quick-add`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as QuickAddData & { error?: string };
      if (!response.ok) throw new Error(body.error || "Product options could not be loaded.");
      setQuickAddData(body);
      setSelectedValues(Object.fromEntries(body.options.map((option) => [option.id, option.values[0]?.id ?? ""])));
    } catch (error) {
      setCartState("error");
      setCartMessage(error instanceof Error ? error.message : "Product options could not be loaded.");
    } finally {
      setQuickAddLoading(false);
    }
  }

  async function handleAddToCart() {
    if (cartState === "pending" || !quickAddData) return;
    if ((quickAddData.variants.length > 0 && !selectedVariant) || selectedVariant?.availability.state === "OUT_OF_STOCK") return;
    setCartState("pending");
    setCartMessage("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ productId: quickAddData.id, variantId: selectedVariant?.id ?? null, quantity: 1 }),
      });
      const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
      if (!response.ok) {
        if (body?.error?.code === "CART_UNAUTHORIZED") {
          setCartState("error");
          setCartMessage("Please sign in to add items to your cart.");
          return;
        }
        throw new Error(body?.error?.message || "Could not add this item to your cart.");
      }
      setCartState("success");
      setCartMessage("Added to cart. You can keep shopping.");
      setQuickAddOpen(false);
    } catch (error) {
      setCartState("error");
      setCartMessage(error instanceof Error ? error.message : "Could not add this item to your cart.");
    }
  }

  return (
    <Card className="group overflow-hidden border-0 p-0 shadow-none transition-transform duration-200 hover:-translate-y-1 lg:shadow-none">
      <div className="relative">
        <Link href={href} className="motion-link block no-underline" aria-label={product.title}>
          <div className="relative aspect-[2/3] overflow-hidden bg-white" onMouseEnter={handleImageEnter} onMouseLeave={handleImageLeave}>
            {activeImage ? (
              <Image key={activeImage.url} src={activeImage.url} alt={activeImage.altText ?? (hoverImageIndex > 0 ? `${product.title} alternate view ${hoverImageIndex}` : product.title)} fill loading="lazy" sizes="(max-width: 1023px) 50vw, (max-width: 1535px) 33vw, 25vw" className="scale-[1.4] object-cover transition-transform duration-300 group-hover:scale-[1.45] sm:scale-[1.16] sm:group-hover:scale-[1.2]" />
            ) : (
              <div className="flex h-full items-center justify-center bg-primary-yellow p-6 text-center text-sm font-900 uppercase">Image coming soon</div>
            )}
          </div>
        </Link>
        {savings ? <span className="absolute left-3 top-3 z-10 border-2 border-primary-red bg-primary-red px-2.5 py-1.5 text-[0.68rem] font-900 uppercase tracking-[0.05em] text-white">Save {savings}%</span> : null}
        <Link href={href} aria-label={`View ${product.title}`} className="motion-icon absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-circle border-2 border-border bg-white no-underline shadow-hard-sm hover:bg-primary-yellow">
          <Heart size={19} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>

      <button type="button" disabled={unavailable} onClick={() => void openQuickAdd()} aria-label={`Add ${product.title} to cart`} className="motion-press flex min-h-12 w-full items-center justify-center gap-2 border-x-0 border-b-2 border-border bg-transparent px-4 py-3 text-xs font-900 uppercase tracking-[0.12em] text-foreground transition-[background-color,color,opacity,border-color] duration-200 hover:bg-primary-blue hover:text-primary-yellow disabled:cursor-not-allowed sm:border-transparent sm:text-transparent sm:opacity-0 sm:pointer-events-none sm:group-hover:border-border sm:group-hover:border-b-4 sm:group-hover:border-solid sm:group-hover:bg-primary-blue sm:group-hover:!text-primary-yellow sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto lg:border-b-4">
        <ShoppingCart className="text-current" size={16} strokeWidth={2.5} aria-hidden="true" />
        <span className="text-current">{unavailable ? "Out of stock" : "Add to cart"}</span>
      </button>

      <div className="bg-white px-3 pb-4 pt-4 sm:px-4">
        <Link href={href} className="block no-underline hover:no-underline">
          <h3 className="line-clamp-2 min-h-[2.7rem] text-[0.98rem] font-900 uppercase leading-[1.12] tracking-[-0.01em] no-underline">{product.title}</h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {product.compareAtPrice ? <span className="text-sm leading-none text-muted-foreground line-through" aria-label="Original price">{formatCatalogMoney(product.compareAtPrice, product.currency)}</span> : null}
          <span className="text-base font-900 leading-none text-primary-red sm:text-lg">{formatCatalogMoney(product.price, product.currency)}</span>
        </div>
      </div>

      {quickAddOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickAddOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`quick-add-title-${product.id}`} className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto border-4 border-border bg-[#f7f3ec] p-4 text-foreground shadow-hard-lg sm:max-h-[calc(100dvh-2rem)] sm:p-7">
            <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-900 uppercase tracking-[.2em] text-primary-blue">Quick add</p>
                <h2 id={`quick-add-title-${product.id}`} className="mt-2 break-words text-[clamp(1.75rem,7vw,3rem)] font-900 uppercase leading-[0.95] tracking-[-0.04em] [overflow-wrap:anywhere]">{product.title}</h2>
              </div>
              <button type="button" onClick={() => setQuickAddOpen(false)} aria-label="Close quick add" className="flex size-9 shrink-0 items-center justify-center border-2 border-border bg-white hover:bg-primary-yellow"><X size={18} /></button>
            </div>
            {quickAddLoading ? <p className="py-8 text-sm font-800 uppercase" role="status">Loading options…</p> : null}
            {!quickAddLoading && quickAddData?.options.map((option) => (
              <label key={option.id} className="mt-5 block text-xs font-900 uppercase tracking-[.1em]">
                {option.name}
                <select value={selectedValues[option.id] ?? ""} onChange={(event) => { setSelectedValues((current) => ({ ...current, [option.id]: event.target.value })); setCartState("idle"); setCartMessage(""); }} className="mt-2 min-h-12 w-full min-w-0 border-2 border-border bg-white px-3 text-sm font-800 normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-primary-blue">
                  {option.values.map((value) => <option key={value.id} value={value.id}>{value.displayName}</option>)}
                </select>
              </label>
            ))}
            {!quickAddLoading && quickAddData && quickAddData.options.length > 0 && !selectedVariant ? <p className="mt-4 text-sm font-700">This combination is unavailable. Choose another option.</p> : null}
            {selectedVariant?.availability.state === "OUT_OF_STOCK" ? <p className="mt-4 text-sm font-800 text-primary-red">This option is out of stock.</p> : null}
            {cartMessage ? <p className={`mt-4 text-sm font-800 ${cartState === "error" ? "text-primary-red" : "text-green-800"}`} role="status">{cartMessage}</p> : null}
            {!quickAddLoading && quickAddData ? (
              <button type="button" onClick={() => void handleAddToCart()} disabled={cartState === "pending" || ((quickAddData.variants.length > 0 && !selectedVariant) || selectedVariant?.availability.state === "OUT_OF_STOCK")} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border-2 border-border bg-primary-blue px-3 py-3 text-center text-sm font-900 uppercase tracking-[.04em] text-primary-yellow shadow-hard-sm hover:bg-primary-yellow hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:tracking-[.08em]">
                {cartState === "pending" ? "Adding…" : cartState === "success" ? <><Check size={17} /> Added to cart</> : <><ShoppingCart size={17} /> Add to cart</>}
              </button>
            ) : null}
            {cartState === "error" && cartMessage.includes("sign in") ? <Link href={`/login?next=${encodeURIComponent(href)}`} className="mt-3 block text-center text-sm font-900 uppercase underline">Sign in to continue</Link> : null}
          </section>
        </div>,
        document.body,
      ) : null}
    </Card>
  );
}
