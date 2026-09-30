"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { IconButton } from "@/components/ui/icon-button";
import type { CartDto } from "@/lib/cart/contracts";

type ApiError = { error?: { code?: string; message?: string } };

function customerError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Cart could not be loaded. Please try again.";
}

async function cartRequest(input: RequestInfo | URL, init?: RequestInit): Promise<CartDto> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const body = await response.json().catch(() => null) as ApiError | CartDto | null;
  if (!response.ok) {
    const message = body && "error" in body && body.error?.message
      ? body.error.message
      : "Cart request failed.";
    throw new Error(message);
  }
  return body as CartDto;
}

function availabilityLabel(state: CartDto["items"][number]["availability"]) {
  switch (state) {
    case "PRODUCT_UNAVAILABLE": return "Product unavailable";
    case "VARIANT_UNAVAILABLE": return "Selected option unavailable";
    case "INSUFFICIENT_AVAILABILITY": return "Quantity no longer available";
    default: return "Available";
  }
}

export function CartPage() {
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadCart = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const next = await cartRequest("/api/cart");
      if (version === requestVersion.current) setCart(next);
    } catch (reason) {
      if (version === requestVersion.current) setError(customerError(reason));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const version = ++requestVersion.current;

    void (async () => {
      try {
        const next = await cartRequest("/api/cart");
        if (version === requestVersion.current) setCart(next);
      } catch (reason) {
        if (version === requestVersion.current) setError(customerError(reason));
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    })();
  }, []);

  async function mutate(key: string, url: string, init?: RequestInit) {
    const version = ++requestVersion.current;
    setPending(key);
    setError(null);
    try {
      const next = await cartRequest(url, init);
      if (version === requestVersion.current) setCart(next);
    } catch (reason) {
      if (version === requestVersion.current) setError(customerError(reason));
    } finally {
      if (version === requestVersion.current) setPending(null);
    }
  }

  if (loading) {
    return (
      <Container className="py-10 sm:py-14 lg:py-16" aria-busy="true">
        <div className="max-w-3xl border-4 border-border bg-white p-6 shadow-hard-md">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Cart</p>
          <h1 className="mt-3">Loading cart</h1>
          <div className="mt-6 h-5 w-2/3 animate-pulse bg-muted" />
          <div className="mt-3 h-5 w-1/2 animate-pulse bg-muted" />
        </div>
      </Container>
    );
  }

  if (error && !cart) {
    return (
      <Container className="py-10 sm:py-14 lg:py-16">
        <section aria-labelledby="cart-error" className="max-w-3xl">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Cart</p>
          <h1 id="cart-error" className="mt-3">Cart unavailable</h1>
          <Alert variant="error" title="Could not load your cart" className="mt-6">{error}</Alert>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => void loadCart()}>Try again</Button>
            <Button href="/shop" variant="yellow">Continue shopping</Button>
          </div>
        </section>
      </Container>
    );
  }

  const items = cart?.items ?? [];

  return (
    <Container className="py-10 sm:py-14 lg:py-16">
      <header className="border-b-4 border-border pb-6">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Your selection</p>
        <h1 className="mt-3">Cart{items.length ? <span className="ml-3 text-2xl font-700 normal-case">({items.length})</span> : null}</h1>
      </header>

      {error ? <Alert variant="error" title="Cart update failed" className="mt-6">{error}</Alert> : null}

      {!items.length ? (
        <section className="mt-8 border-4 border-border bg-white p-8 text-center shadow-hard-md" aria-labelledby="empty-cart">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Nothing selected</p>
          <h2 id="empty-cart" className="mt-3 text-3xl">Your cart is empty</h2>
          <p className="mx-auto mt-4 max-w-xl">Explore the live catalog and add a valid product selection when Cart access is available.</p>
          <div className="mt-6"><Button href="/shop" variant="yellow">Browse shop</Button></div>
        </section>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section aria-labelledby="cart-items" className="grid gap-4">
            <h2 id="cart-items" className="sr-only">Cart items</h2>
            {items.map((item) => {
              const unavailable = item.availability !== "AVAILABLE";
              const busy = pending === item.id || pending === "clear";
              return (
                <article key={item.id} className="border-4 border-border bg-white p-4 shadow-hard-sm sm:p-5" aria-busy={busy}>
                  <div className="grid gap-5 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-start">
                    <div className="aspect-square overflow-hidden border-2 border-border bg-muted">
                      {item.product?.media?.url ? (
                        <img src={item.product.media.url} alt={item.product.media.altText ?? item.product.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-3 text-center text-xs font-900 uppercase">No image</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-900 uppercase tracking-[.15em] text-primary-blue">Product</p>
                      <h3 className="mt-1 break-words text-xl">{item.product?.title ?? "Unavailable product"}</h3>
                      {item.variant ? (
                        <p className="mt-2 text-sm font-700 uppercase">
                          {[item.variant.displayName, item.variant.size, item.variant.color].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {unavailable ? (
                        <p className="mt-3 border-2 border-border bg-primary-yellow px-3 py-2 text-sm font-800 uppercase">{availabilityLabel(item.availability)}</p>
                      ) : null}
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-800 uppercase">Quantity</span>
                        <IconButton label="Decrease quantity" disabled={busy || unavailable || item.quantity <= 1} onClick={() => void mutate(item.id, `/api/cart/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ quantity: item.quantity - 1 }) })}><Minus size={18} aria-hidden="true" /></IconButton>
                        <output className="min-w-11 text-center text-lg font-900" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</output>
                        <IconButton label="Increase quantity" disabled={busy || unavailable} onClick={() => void mutate(item.id, `/api/cart/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ quantity: item.quantity + 1 }) })}><Plus size={18} aria-hidden="true" /></IconButton>
                        <button type="button" disabled={busy} onClick={() => void mutate(item.id, `/api/cart/items/${item.id}`, { method: "DELETE" })} className="motion-press ml-2 inline-flex min-h-11 items-center gap-2 border-2 border-border bg-white px-3 py-2 text-xs font-900 uppercase hover:bg-primary-red hover:text-white" aria-label={`Remove ${item.product?.title ?? "item"} from cart`}><Trash2 size={18} aria-hidden="true" />Remove</button>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs font-900 uppercase tracking-[.15em]">Current price</p>
                      <p className="mt-1 text-lg font-900">{item.unitPrice ?? "—"}{item.currency ? ` ${item.currency}` : ""}</p>
                      <p className="mt-3 text-xs font-900 uppercase tracking-[.15em]">Line subtotal</p>
                      <p className="mt-1 text-xl font-900">{item.subtotal ?? "—"}{item.currency ? ` ${item.currency}` : ""}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="border-4 border-border bg-primary-yellow p-5 shadow-hard-md lg:sticky lg:top-6" aria-labelledby="cart-summary">
            <div className="flex items-center justify-between gap-4">
              <h2 id="cart-summary" className="text-2xl">Summary</h2>
              <span className="text-xs font-900 uppercase">{items.length} items</span>
            </div>
            {cart?.hasUnavailableItems ? <p className="mt-4 border-2 border-border bg-white p-3 text-sm font-800 uppercase">Resolve unavailable items before any future purchase step.</p> : null}
            <div className="mt-6 flex items-end justify-between gap-4 border-t-2 border-border pt-4">
              <span className="text-sm font-900 uppercase">Subtotal</span>
              <span className="text-2xl font-900">{cart?.subtotal ?? "0.00"}{cart?.currency ? ` ${cart.currency}` : ""}</span>
            </div>
            <p className="mt-4 text-xs font-700 uppercase">Prices and availability are confirmed by the server Cart response.</p>
            <button type="button" disabled={pending === "clear"} onClick={() => void mutate("clear", "/api/cart", { method: "DELETE" })} className="motion-press mt-6 inline-flex min-h-12 w-full items-center justify-center border-2 border-border bg-white px-4 py-3 text-sm font-900 uppercase hover:bg-primary-red hover:text-white disabled:cursor-not-allowed disabled:bg-muted">Clear cart</button>
            <p className="mt-4 text-xs font-700 uppercase">Checkout is not available yet.</p>
          </aside>
        </div>
      )}
    </Container>
  );
}
