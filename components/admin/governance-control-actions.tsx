"use client";

import { useState } from "react";

export function GovernanceControlActions({ controlKey, canVerify }: { controlKey: string; canVerify: boolean }) {
  const [state, setState] = useState<string>("");
  const [busy, setBusy] = useState(false);
  if (!canVerify) return <span className="text-xs">Read-only</span>;
  async function verify() {
    setBusy(true);
    setState("");
    try {
      const response = await fetch("/api/admin/governance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "verify", controlKey }) });
      const payload = await response.json() as { verification?: { result?: string; status?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Verification failed.");
      setState((payload.verification?.status || payload.verification?.result || "completed").toString());
    } catch (error) {
      setState(error instanceof Error ? error.message : "Verification failed.");
    } finally { setBusy(false); }
  }
  return <div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={verify} className="border-2 border-black bg-[#f7d51d] px-2 py-1 text-xs font-black uppercase disabled:opacity-50">{busy ? "Checking…" : "Verify"}</button>{state ? <span className="text-xs font-bold">{state}</span> : null}</div>;
}
