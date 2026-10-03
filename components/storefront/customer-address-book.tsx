"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { CustomerAddressDto } from "@/lib/customer/contracts";

type FormState = {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label: string;
};

const emptyForm: FormState = {
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateOrProvince: "",
  postalCode: "",
  countryCode: "IN",
  label: "Home",
};

function toForm(address: CustomerAddressDto): FormState {
  return {
    recipientName: address.recipientName,
    phone: address.phone ?? "",
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    stateOrProvince: address.stateOrProvince,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    label: address.label,
  };
}

export function CustomerAddressBook() {
  const [addresses, setAddresses] = useState<CustomerAddressDto[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/customer/addresses", { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => null) as { addresses?: CustomerAddressDto[]; error?: { message?: string } } | null;
      if (!response.ok || !body?.addresses) throw new Error(body?.error?.message ?? "Addresses could not be loaded.");
      setAddresses(body.addresses);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Addresses could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function beginEdit(address: CustomerAddressDto) {
    setEditingId(address.id);
    setForm(toForm(address));
    setError(null);
  }

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const endpoint = editingId ? `/api/customer/addresses/${encodeURIComponent(editingId)}` : "/api/customer/addresses";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Address could not be saved.");
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Address could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(addressId: string) {
    if (!window.confirm("Remove this saved address?")) return;
    setBusyId(addressId);
    setError(null);
    try {
      const response = await fetch(`/api/customer/addresses/${encodeURIComponent(addressId)}`, { method: "DELETE", credentials: "same-origin" });
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Address could not be removed.");
      if (editingId === addressId) beginCreate();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Address could not be removed.");
    } finally {
      setBusyId(null);
    }
  }

  async function makeDefault(addressId: string) {
    setBusyId(addressId);
    setError(null);
    try {
      const response = await fetch(`/api/customer/addresses/${encodeURIComponent(addressId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Default address could not be changed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Default address could not be changed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-12 grid gap-6 border-t border-black/10 pt-8" aria-labelledby="address-heading">
      <div>
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Addresses</p>
        <h2 id="address-heading" className="mt-2 text-xl uppercase">Saved addresses</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6">Manage current delivery addresses. Historical order and shipment destinations are preserved separately.</p>
      </div>

      {error ? <Alert variant="error" title="Address operation failed">{error}</Alert> : null}

      <Card>
        <CardHeader><CardTitle>{editingId ? "Edit address" : "Add address"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-5" aria-busy={saving}>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Recipient name" htmlFor="address-recipient" required><Input id="address-recipient" value={form.recipientName} onChange={(e) => setField("recipientName", e.target.value)} maxLength={120} required /></FormField>
              <FormField label="Phone" htmlFor="address-phone"><Input id="address-phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} maxLength={32} autoComplete="tel" /></FormField>
            </div>
            <FormField label="Address line 1" htmlFor="address-line1" required><Input id="address-line1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} maxLength={200} autoComplete="address-line1" required /></FormField>
            <FormField label="Address line 2" htmlFor="address-line2"><Input id="address-line2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} maxLength={200} autoComplete="address-line2" /></FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="City" htmlFor="address-city" required><Input id="address-city" value={form.city} onChange={(e) => setField("city", e.target.value)} maxLength={100} autoComplete="address-level2" required /></FormField>
              <FormField label="State / province" htmlFor="address-state" required><Input id="address-state" value={form.stateOrProvince} onChange={(e) => setField("stateOrProvince", e.target.value)} maxLength={100} autoComplete="address-level1" required /></FormField>
              <FormField label="Postal code" htmlFor="address-postal" required><Input id="address-postal" value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} maxLength={32} autoComplete="postal-code" required /></FormField>
              <FormField label="Country code" htmlFor="address-country" description="ISO 3166-1 alpha-2." required><Input id="address-country" value={form.countryCode} onChange={(e) => setField("countryCode", e.target.value.toUpperCase())} maxLength={2} autoComplete="country" required /></FormField>
            </div>
            <FormField label="Label" htmlFor="address-label"><Input id="address-label" value={form.label} onChange={(e) => setField("label", e.target.value)} maxLength={40} placeholder="Home, Work…" /></FormField>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>{editingId ? "Save address" : "Add address"}</Button>
              {editingId ? <Button type="button" variant="outline" onClick={beginCreate}>Cancel edit</Button> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current saved addresses</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading addresses…</p> : null}
          {!loading && addresses.length === 0 ? <p className="text-sm text-muted-foreground">No saved addresses yet.</p> : null}
          {!loading && addresses.length > 0 ? (
            <ul className="grid gap-4">
              {addresses.map((address) => (
                <li key={address.id} className="border-2 border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="grid gap-1 text-sm leading-6">
                      <strong>{address.label}{address.isDefault ? " · Default" : ""}</strong>
                      <span>{address.recipientName}{address.phone ? ` · ${address.phone}` : ""}</span>
                      <span>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}</span>
                      <span>{address.city}, {address.stateOrProvince} {address.postalCode}, {address.countryCode}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => beginEdit(address)}>Edit</Button>
                      {!address.isDefault ? <Button type="button" variant="outline" loading={busyId === address.id} onClick={() => makeDefault(address.id)}>Set default</Button> : null}
                      <Button type="button" variant="outline" loading={busyId === address.id} onClick={() => remove(address.id)}>Remove</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
