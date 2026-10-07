"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CatalogDeleteButton({ productId, title }: { productId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete "${title}" permanently from the catalog? This cannot be undone.\n\nIf the product has active cart references, deletion will be blocked; archive it instead.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/catalog/${productId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Product could not be deleted.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Product could not be deleted.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={remove} disabled={busy}
        className="border-2 border-black bg-[#ff533d] px-3 py-2 font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Deleting..." : "Delete"}
      </button>
      {error ? <p className="max-w-[260px] text-xs font-bold text-[#d91e18]">{error}</p> : null}
    </div>
  );
}
