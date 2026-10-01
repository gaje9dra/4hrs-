"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { CheckoutDto } from "@/lib/checkout/contracts";
import type { CustomerAddressDto, CustomerDto } from "@/lib/customer/contracts";

type ApiError = { error?: { code?: string; message?: string } };
type UiState = "loading" | "ready" | "address_required" | "validating" | "valid" | "validation_error" | "price_changed" | "availability_changed" | "cart_changed" | "session_expired" | "server_error";

const availabilityStates = new Set(["PRODUCT_UNAVAILABLE", "VARIANT_UNAVAILABLE", "INVALID_QUANTITY", "INSUFFICIENT_AVAILABILITY"]);
const addressStates = new Set(["INVALID_ADDRESS", "ADDRESS_NOT_OWNED", "ADDRESS_NOT_FOUND", "INCOMPLETE_CHECKOUT"]);

async function checkoutRequest(method: "GET" | "POST", selectedAddressId?: string | null, expectedRevision?: CheckoutDto["revision"]): Promise<CheckoutDto> {
  const response = await fetch("/api/checkout", {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    body: method === "POST" ? JSON.stringify({ selectedAddressId, ...(expectedRevision ? { expectedRevision } : {}) }) : undefined,
  });
  const body = await response.json().catch(() => null) as CheckoutDto | ApiError | null;
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) {
    const apiError = body && typeof body === "object" && "error" in body ? (body as ApiError).error?.message : undefined;
    throw new Error(apiError || "Checkout validation failed.");
  }
  return body as CheckoutDto;
}

async function addressRequest(): Promise<CustomerAddressDto[]> {
  const response = await fetch("/api/customer/addresses", { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => null) as { addresses?: CustomerAddressDto[]; error?: { message?: string } } | null;
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(body?.error?.message || "Saved addresses could not be loaded.");
  return body?.addresses ?? [];
}

function classify(dto: CheckoutDto): UiState {
  const state = dto.validation.state;
  if (state === "VALID") return "valid";
  if (state === "PRICE_CHANGED") return "price_changed";\n  if (state === "CART_CHANGED") return "cart_changed";
  if (availabilityStates.has(state)) return "availability_changed";
  if (addressStates.has(state)) return "address_required";
  if (state === "CART_EMPTY" || state === "CART_MISSING") return "cart_changed";
  return "validation_error";
}

function money(value: string, currency: string | null) { return currency ? value + " " + currency : value; }

function AddressCard({ address, selected, disabled, onSelect }: { address: CustomerAddressDto; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return (
    <label htmlFor={"checkout-address-" + address.id} className={"block border-2 border-border bg-white p-4 shadow-hard-sm " + (selected ? "bg-primary-yellow shadow-hard-md" : "hover:bg-muted") + (disabled ? " cursor-not-allowed opacity-60" : " cursor-pointer")}>
      <div className="flex gap-3">
        <input id={"checkout-address-" + address.id} type="radio" name="checkout-address" value={address.id} checked={selected} disabled={disabled} onChange={onSelect} className="mt-1 size-5 accent-primary-red" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-900 uppercase"><span>{address.label}</span>{address.isDefault ? <span className="border-2 border-border bg-white px-2 py-0.5 text-[10px]">Default</span> : null}</span>
          <span className="mt-2 block break-words text-sm leading-6">{address.recipientName}<br />{address.addressLine1}{address.addressLine2 ? <><br />{address.addressLine2}</> : null}<br />{address.city}, {address.stateOrProvince} {address.postalCode}<br />{address.countryCode}{address.phone ? <><br />{address.phone}</> : null}</span>
        </span>
      </div>
    </label>
  );
}

function AddAddressForm({ disabled, onCreated }: { disabled: boolean; onCreated: (address: CustomerAddressDto) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({ recipientName: "", phone: "", addressLine1: "", addressLine2: "", city: "", stateOrProvince: "", postalCode: "", countryCode: "IN", label: "Home" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/customer/addresses", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const body = await response.json().catch(() => null) as { address?: CustomerAddressDto; error?: { message?: string } } | null;
      if (response.status === 401) throw new Error("SESSION_EXPIRED");
      if (!response.ok || !body?.address) throw new Error(body?.error?.message || "Address could not be saved.");
      setValues({ recipientName: "", phone: "", addressLine1: "", addressLine2: "", city: "", stateOrProvince: "", postalCode: "", countryCode: "IN", label: "Home" });
      onCreated(body.address);
    } catch (reason) {
      setError(reason instanceof Error && reason.message !== "SESSION_EXPIRED" ? reason.message : "Your session expired. Please sign in again.");
    } finally { setPending(false); }
  }

  const field = (name: keyof typeof values, label: string, required = true) => (
    <FormField label={label} htmlFor={"checkout-" + name} required={required}>
      <Input id={"checkout-" + name} name={name} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} disabled={pending || disabled} required={required} />
    </FormField>
  );

  return (
    <details className="border-2 border-border bg-white p-4">
      <summary className="cursor-pointer text-sm font-900 uppercase">Add a new address</summary>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2" aria-busy={pending}>
        {error ? <div className="sm:col-span-2"><Alert variant="error" title="Address could not be saved">{error}</Alert></div> : null}
        {field("recipientName", "Recipient name")}{field("phone", "Phone", false)}
        <div className="sm:col-span-2">{field("addressLine1", "Address line 1")}</div>
        <div className="sm:col-span-2">{field("addressLine2", "Address line 2", false)}</div>
        {field("city", "City")}{field("stateOrProvince", "State / province")}{field("postalCode", "Postal code")}{field("countryCode", "Country code")}{field("label", "Label")}
        <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={disabled}>Save address</Button></div>
      </form>
    </details>
  );
}

export function CheckoutPage({ customer }: { customer: CustomerDto }) {
  const [checkout, setCheckout] = useState<CheckoutDto | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [state, setState] = useState<UiState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestVersion = useRef(0);
  const selectedAddressRef = useRef<string | null>(null);\n  const revisionRef = useRef<CheckoutDto["revision"] | undefined>(undefined);

  const load = useCallback(async (preserveSelection: boolean) => {
    const version = ++requestVersion.current;
    setState("loading"); setError(null);
    try {
      const [nextCheckout, nextAddresses] = await Promise.all([checkoutRequest("GET"), addressRequest()]);
      if (version !== requestVersion.current) return;
      setCheckout(nextCheckout); revisionRef.current = nextCheckout.revision; setAddresses(nextAddresses);
      const serverAddress = nextCheckout.address?.id ?? null;
      setSelectedAddressId(preserveSelection && selectedAddressRef.current && nextAddresses.some((item) => item.id === selectedAddressRef.current) ? selectedAddressRef.current : serverAddress);
      setState(classify(nextCheckout));
    } catch (reason) {
      if (version !== requestVersion.current) return;
      setState(reason instanceof Error && reason.message === "SESSION_EXPIRED" ? "session_expired" : "server_error");
      setError("Checkout could not be loaded. Please try again.");
    }
  }, []);

  useEffect(() => {
    const version = ++requestVersion.current;
    Promise.all([checkoutRequest("GET"), addressRequest()])
      .then(([nextCheckout, nextAddresses]) => {
        if (version !== requestVersion.current) return;
        setCheckout(nextCheckout);
        setAddresses(nextAddresses);
        const serverAddress = nextCheckout.address?.id ?? null;
        const nextSelected = selectedAddressRef.current && nextAddresses.some((item) => item.id === selectedAddressRef.current)
          ? selectedAddressRef.current
          : serverAddress;
        selectedAddressRef.current = nextSelected;
        setSelectedAddressId(nextSelected);
        setState(classify(nextCheckout));
      })
      .catch((reason: unknown) => {
        if (version !== requestVersion.current) return;
        setState(reason instanceof Error && reason.message === "SESSION_EXPIRED" ? "session_expired" : "server_error");
        setError("Checkout could not be loaded. Please try again.");
      });
  }, []);

  async function validateSelection(addressId: string | null) {
    if (pending) return;
    const version = ++requestVersion.current;
    selectedAddressRef.current = addressId;
    setSelectedAddressId(addressId); setPending(true); setState("validating"); setError(null);
    try {
      const next = await checkoutRequest("POST", addressId, revisionRef.current);
      if (version !== requestVersion.current) return;
      setCheckout(next); revisionRef.current = next.revision; setState(classify(next));
      if (next.address?.id) { selectedAddressRef.current = next.address.id; setSelectedAddressId(next.address.id); }
    } catch (reason) {
      if (version !== requestVersion.current) return;
      setState(reason instanceof Error && reason.message === "SESSION_EXPIRED" ? "session_expired" : "server_error");
      setError("Checkout validation could not be completed. Please try again.");
    } finally { if (version === requestVersion.current) setPending(false); }
  }

  function addressCreated(address: CustomerAddressDto) {
    setAddresses((current) => [address, ...current.map((item) => item.isDefault ? { ...item, isDefault: false } : item)]);
    void validateSelection(address.id);
  }

  const issues = checkout?.validation.issues ?? [];
  const affectedItems = new Set(issues.flatMap((item) => item.itemId ? [item.itemId] : []));
  const canContinue = state === "valid" && Boolean(checkout?.address) && !pending;

  if (state === "loading") return <div className="border-4 border-border bg-white p-6 shadow-hard-md" aria-busy="true" aria-live="polite"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Checkout</p><h1 className="mt-3">Loading Checkout</h1></div>;
  if (state === "session_expired") return <section aria-labelledby="session-expired"><p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Checkout</p><h1 id="session-expired" className="mt-3">Session expired</h1><Alert variant="error" title="Sign in again" className="mt-6">Your secure session expired. Sign in to continue Checkout.</Alert><div className="mt-6"><Button href="/login?next=%2Fcheckout">Sign in</Button></div></section>;
  if (!checkout) return <section aria-labelledby="checkout-server-error"><h1 id="checkout-server-error">Checkout unavailable</h1><Alert variant="error" title="Please try again" className="mt-6">{error || "Checkout is temporarily unavailable."}</Alert><div className="mt-6 flex gap-3"><Button onClick={() => void load(false)}>Try again</Button><Button href="/cart" variant="yellow">Return to Cart</Button></div></section>;

  const stateMessage = state === "price_changed" ? "A server-confirmed price changed. Review the updated amount before continuing." : state === "availability_changed" ? "A Cart item is no longer available in the requested state." : state === "cart_changed" ? "Your Cart is empty or changed. Return to Cart to update it." : null;

  return (
    <div>
      <header className="border-b-4 border-border pb-6">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">4HRS / Secure storefront</p>
        <h1 className="mt-3">Checkout</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6">Review your server-confirmed Cart, choose a delivery address, and validate Checkout. Payment is not available in this release.</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <main className="grid gap-6" aria-live="polite">
          <Card><p className="text-xs font-900 uppercase tracking-[.2em] text-primary-blue">Customer</p><h2 className="mt-2 text-2xl">{customer.displayName || customer.email}</h2><p className="mt-1 text-sm">{customer.email}</p></Card>

          <section aria-labelledby="address-heading" className="grid gap-4">
            <div><p className="text-xs font-900 uppercase tracking-[.2em] text-primary-blue">Delivery</p><h2 id="address-heading" className="mt-2 text-3xl">Choose an address</h2><p className="mt-2 text-sm">The selected address is revalidated against your account on the server.</p></div>
            {issues.length ? <Alert variant={state === "valid" ? "success" : "error"} title={state === "address_required" ? "Address required" : "Checkout validation"}>{issues.map((item) => <span key={item.code + (item.itemId ?? "")} className="block">{item.message}</span>)}</Alert> : null}
            {addresses.length ? <div className="grid gap-3" role="radiogroup" aria-labelledby="address-heading">{addresses.map((address) => <AddressCard key={address.id} address={address} selected={selectedAddressId === address.id} disabled={pending} onSelect={() => void validateSelection(address.id)} />)}</div> : <Alert variant="error" title="No saved address">Add a delivery address before continuing.</Alert>}
            <AddAddressForm disabled={pending} onCreated={addressCreated} />
          </section>

          {stateMessage ? <section aria-labelledby="cart-state"><Alert variant="error" title={state === "price_changed" ? "Price changed" : state === "cart_changed" ? "Cart changed" : "Availability changed"}>{stateMessage}</Alert><div className="mt-4"><Button href="/cart" variant="yellow">Review Cart</Button></div></section> : null}

          <Card><p className="text-xs font-900 uppercase tracking-[.2em] text-primary-blue">Next step</p><h2 className="mt-2 text-2xl">Payment unavailable</h2><p className="mt-3 text-sm leading-6">Payment processing is not implemented yet. No payment credentials are collected and no payment action is simulated.</p></Card>
        </main>

        <aside className="border-4 border-border bg-primary-yellow p-5 shadow-hard-md lg:sticky lg:top-6" aria-labelledby="checkout-summary">
          <div className="flex items-center justify-between gap-4"><h2 id="checkout-summary" className="text-2xl">Order summary</h2><span className="text-xs font-900 uppercase">{checkout.cart.items.length} items</span></div>
          <div className="mt-5 grid gap-4">{checkout.cart.items.map((item) => <article key={item.id} className={"border-2 border-border bg-white p-3 " + (affectedItems.has(item.id) ? "ring-2 ring-primary-red" : "")}><div className="flex gap-3"><div className="relative size-16 shrink-0 overflow-hidden border-2 border-border bg-muted">{item.product?.media?.url ? <Image src={item.product.media.url} alt={item.product.media.altText ?? item.product.title} fill sizes="4rem" className="object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] font-900 uppercase">No image</span>}</div><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-900 uppercase">{item.product?.title ?? "Unavailable product"}</h3>{item.variant ? <p className="mt-1 text-xs font-700">{[item.variant.displayName, item.variant.size, item.variant.color].filter(Boolean).join(" · ")}</p> : null}<p className="mt-2 text-xs font-800 uppercase">Qty {item.quantity}</p></div><p className="text-sm font-900">{money(item.subtotal ?? "—", item.currency)}</p></div></article>)}</div>
          <dl className="mt-6 grid gap-3 border-t-2 border-border pt-4 text-sm"><div className="flex justify-between gap-4"><dt className="font-900 uppercase">Merchandise</dt><dd>{money(checkout.totals.merchandiseSubtotal, checkout.totals.currency)}</dd></div>{checkout.totals.adjustments.map((item) => <div key={item.code} className="flex justify-between gap-4"><dt>{item.code}</dt><dd>{money(item.amount, checkout.totals.currency)}</dd></div>)}{checkout.totals.charges.map((item) => <div key={item.code} className="flex justify-between gap-4"><dt>{item.code}</dt><dd>{money(item.amount, checkout.totals.currency)}</dd></div>)}<div className="flex justify-between gap-4 border-t-2 border-border pt-3 text-xl font-900"><dt className="uppercase">Total</dt><dd>{money(checkout.totals.total, checkout.totals.currency)}</dd></div></dl>
          <div className="mt-5"><Button type="button" disabled={!canContinue} loading={state === "validating"} className="w-full">Continue to payment</Button><p className="mt-3 text-xs font-700 uppercase">Payment will become available in a future phase.</p></div>
          <Button href="/cart" variant="ghost" className="mt-4 w-full text-xs">Return to Cart</Button>
        </aside>
      </div>
    </div>
  );
}
