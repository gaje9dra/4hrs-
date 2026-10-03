"use client";

import { useEffect, useState } from "react";

type Preference = {
  category: "MARKETING_PROMOTIONAL";
  channel: "EMAIL";
  state: "OPTED_IN" | "OPTED_OUT";
  version: number;
};

export function CustomerCommunicationPreferences() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/customer/communications/preferences", { credentials: "same-origin", cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { preferences?: Preference[]; error?: { message?: string } } | null;
      if (!response.ok || !body?.preferences) throw new Error(body?.error?.message ?? "Communication preferences could not be loaded.");
      setPreference(body.preferences.find((item) => item.category === "MARKETING_PROMOTIONAL" && item.channel === "EMAIL") ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Communication preferences could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function setMarketingOptIn(enabled: boolean) {
    if (!preference) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/customer/communications/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          category: preference.category,
          channel: preference.channel,
          state: enabled ? "OPTED_IN" : "OPTED_OUT",
          expectedVersion: preference.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = (await response.json().catch(() => null)) as { preference?: Preference; error?: { message?: string } } | null;
      if (response.status === 409) {
        await load();
        throw new Error(body?.error?.message ?? "Your preference changed in another session. The current value has been loaded.");
      }
      if (!response.ok || !body?.preference) throw new Error(body?.error?.message ?? "Communication preference could not be saved.");
      setPreference(body.preference);
      setMessage(enabled ? "Promotional email preference saved." : "Promotional email has been turned off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Communication preference could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12 border-t-4 border-black pt-8" aria-labelledby="communication-preferences-heading">
      <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Communication</p>
      <h2 id="communication-preferences-heading" className="mt-2 text-2xl uppercase">Communication preferences</h2>
      <div className="mt-5 border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-black uppercase">Transactional communication</p>
            <p className="mt-1 text-sm leading-6">Order, payment, shipping, return, cancellation, support, and security messages may be required to operate your account and are not disabled by marketing preferences.</p>
          </div>
          <span className="border-2 border-black bg-[#e7e0d2] px-3 py-2 text-center text-xs font-black uppercase">Required</span>
        </div>
        <div className="mt-6 border-t-2 border-black pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black uppercase">Promotional email</p>
              <p className="mt-1 text-sm leading-6">Optional promotional and marketing email. This is off until you explicitly opt in.</p>
            </div>
            <label className="inline-flex min-h-12 items-center gap-3 border-2 border-black px-4 py-3 font-black uppercase focus-within:ring-2 focus-within:ring-primary-blue">
              <input
                type="checkbox"
                checked={preference?.state === "OPTED_IN"}
                disabled={loading || busy || !preference}
                onChange={(event) => void setMarketingOptIn(event.target.checked)}
                className="h-5 w-5"
              />
              <span>{loading ? "Loading…" : preference?.state === "OPTED_IN" ? "Opted in" : "Opted out"}</span>
            </label>
          </div>
        </div>
      </div>
      {message ? <p className="mt-3 border-2 border-black bg-white p-3 text-sm font-bold" role="status">{message}</p> : null}
    </section>
  );
}
