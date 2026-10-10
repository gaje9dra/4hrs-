"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "REFRESH_HEALTH" | "RUN_RECONCILIATION" | "TRIGGER_SYNTHETIC";

export function OperationsActions({ canManage, canTriggerSynthetic }: { canManage: boolean; canTriggerSynthetic: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function run(action: Action) {
    if (reason.trim().length < 3) {
      setError("Enter an operational reason of at least 3 characters.");
      return;
    }
    if (action === "RUN_RECONCILIATION" && !window.confirm("Run reconciliation now? This can execute bounded recovery actions.")) return;
    if (action === "TRIGGER_SYNTHETIC" && !window.confirm("Run this synthetic workflow in manual diagnostic mode?")) return;
    setBusy(action);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim(), ...(action === "TRIGGER_SYNTHETIC" ? { workflowId: workflowId.trim() } : {}) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "The operational action failed.");
      setSuccess(action === "REFRESH_HEALTH" ? "Health snapshot refreshed." : action === "RUN_RECONCILIATION" ? "Reconciliation request completed." : "Synthetic diagnostic request completed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operational action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!canManage) return <p className="mt-3 rounded-lg bg-stone-50 p-4 text-sm text-stone-600">This account has read-only operational access. A user with the Operations Manage permission is required to run operator actions.</p>;

  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-stone-700">Reason for this operation (required)</span>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="Describe the operational reason…" className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900" />
      </label>
      {canTriggerSynthetic && <label className="block">
        <span className="text-sm font-semibold text-stone-700">Synthetic workflow ID</span>
        <input value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} maxLength={200} placeholder="Enter an existing workflow ID" className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900" />
      </label>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null || reason.trim().length < 3} onClick={() => void run("REFRESH_HEALTH")} className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "REFRESH_HEALTH" ? "Refreshing…" : "Refresh health"}</button>
        <button type="button" disabled={busy !== null || reason.trim().length < 3} onClick={() => void run("RUN_RECONCILIATION")} className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-800 disabled:cursor-not-allowed disabled:opacity-50">{busy === "RUN_RECONCILIATION" ? "Reconciling…" : "Run reconciliation"}</button>
        {canTriggerSynthetic && <button type="button" disabled={busy !== null || reason.trim().length < 3 || !workflowId.trim()} onClick={() => void run("TRIGGER_SYNTHETIC")} className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-800 disabled:cursor-not-allowed disabled:opacity-50">{busy === "TRIGGER_SYNTHETIC" ? "Starting…" : "Run synthetic diagnostic"}</button>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{success}</p>}
    </div>
  );
}
