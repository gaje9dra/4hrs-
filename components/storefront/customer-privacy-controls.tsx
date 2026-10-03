"use client";

import { useState } from "react";

const CONFIRMATION = "DELETE MY ACCOUNT";

export function CustomerPrivacyControls() {
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestDeletion() {
    const confirmation = window.prompt(`Type ${CONFIRMATION} to permanently anonymize this account.`);
    if (confirmation !== CONFIRMATION) return;

    setBusy("delete");
    setError(null);
    try {
      const response = await fetch("/api/customer/privacy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "The account could not be deleted.");
      window.location.assign("/login?deleted=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The account could not be deleted.");
      setBusy(null);
    }
  }

  return (
    <section className="mt-12 border-t border-black/10 pt-8" aria-labelledby="privacy-heading">
      <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-red">Privacy</p>
      <h2 id="privacy-heading" className="mt-2 text-xl uppercase">Your customer data</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6">
        Export the customer data available to your account, or request account deletion. Historical order and financial records are retained where required for business integrity.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy("export");
            setError(null);
            window.location.assign("/api/customer/privacy");
          }}
          className="rounded border border-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "export" ? "Preparing export…" : "Export my data"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={requestDeletion}
          className="rounded border border-primary-red px-4 py-2 text-sm font-semibold text-primary-red disabled:opacity-50"
        >
          {busy === "delete" ? "Deleting…" : "Delete my account"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-primary-red" role="alert">{error}</p> : null}
    </section>
  );
}
