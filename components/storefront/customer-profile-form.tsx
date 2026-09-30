"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { CustomerDto } from "@/lib/customer/contracts";

export function CustomerProfileForm({ initialCustomer }: { initialCustomer: CustomerDto }) {
  const [displayName, setDisplayName] = useState(initialCustomer.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setSuccess(false);
    if (displayName.trim().length > 120) {
      setError("Display name must be 120 characters or fewer.");
      requestAnimationFrame(() => ref.current?.focus());
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      const body = await response.json().catch(() => null) as { customer?: CustomerDto; error?: { message?: string } } | null;
      if (!response.ok || !body?.customer) {
        setError(body?.error?.message ?? "Profile could not be updated.");
        requestAnimationFrame(() => ref.current?.focus());
        return;
      }
      setDisplayName(body.customer.displayName ?? "");
      setSuccess(true);
    } catch {
      setError("Profile is temporarily unavailable. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Editable profile</CardTitle></CardHeader>
      <CardContent>
        {error ? <Alert variant="error" title="Profile update failed" className="mb-5">{error}</Alert> : null}
        {success ? <Alert variant="success" title="Profile updated" className="mb-5">Your display name was saved.</Alert> : null}
        <form onSubmit={submit} className="grid gap-5" aria-busy={saving}>
          <FormField label="Display name" htmlFor="customer-display-name" description="This is the only editable profile field currently supported." required={false}>
            <Input ref={ref} id="customer-display-name" name="displayName" autoComplete="nickname" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setError(null); setSuccess(false); }} maxLength={120} />
          </FormField>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={saving}>Save profile</Button>
            <Button href="/account" variant="outline">Back to account</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
