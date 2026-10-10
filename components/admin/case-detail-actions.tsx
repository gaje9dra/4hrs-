"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CaseDetailActions({ caseReference, status, canUpdate, canResolve }: { caseReference: string; status: string; canUpdate: boolean; canResolve: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [resolution, setResolution] = useState("NO_ACTION_REQUIRED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canTransition = ["OPEN", "TRIAGED", "ASSIGNED", "WAITING"].includes(status);
  const canResolveInCurrentState = ["IN_PROGRESS", "WAITING", "RESOLVED"].includes(status);
  const transitionTarget = status === "OPEN" ? "TRIAGED" : "IN_PROGRESS";

  async function post(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() + "case" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? "Operation failed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">Operational actions</h3>
        <p className="mt-1 text-sm text-stone-500">Actions are validated by the case lifecycle and recorded in the audit history.</p>
      </div>
      <div className="grid max-w-2xl gap-4">
        {canUpdate && canTransition && <button type="button" disabled={busy} onClick={() => void post("/api/admin/cases/" + encodeURIComponent(caseReference) + "/transition", { to: transitionTarget, reason: status === "OPEN" ? "operator_triage" : "operator_work_started" })} className="w-fit rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Working…" : status === "OPEN" ? "Triage case" : "Start work"}</button>}
        {canUpdate && <div className="space-y-2">
          <label className="block text-sm font-semibold text-stone-700" htmlFor="case-internal-note">Add internal note</label>
          <textarea id="case-internal-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a note for other administrators…" maxLength={4000} rows={3} className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900" />
          <button type="button" disabled={busy || !note.trim()} onClick={() => void post("/api/admin/cases/" + encodeURIComponent(caseReference) + "/notes", { body: note })} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 disabled:cursor-not-allowed disabled:opacity-50">Add note</button>
        </div>}
        {canResolve && canResolveInCurrentState && <div className="space-y-3 rounded-lg bg-stone-50 p-4">
          <h4 className="font-bold">Resolve case</h4>
          <label className="block text-sm font-semibold text-stone-700" htmlFor="case-resolution">Resolution</label>
          <select id="case-resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900">
            {["NO_ACTION_REQUIRED", "INFORMATION_PROVIDED", "RETURN_APPROVED", "RETURN_REJECTED", "ORDER_CANCELLED", "SHIPMENT_RECONCILED", "FULFILLMENT_RESOLVED", "DUPLICATE", "ESCALATED"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
          <label className="block text-sm font-semibold text-stone-700" htmlFor="case-resolution-summary">Resolution reason</label>
          <textarea id="case-resolution-summary" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Explain the resolution…" maxLength={1000} rows={3} className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900" />
          <button type="button" disabled={busy || !summary.trim() || status === "RESOLVED"} onClick={() => void post("/api/admin/cases/" + encodeURIComponent(caseReference) + "/resolve", { resolutionType: resolution, summary })} className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Resolve case"}</button>
          {status === "RESOLVED" && <button type="button" disabled={busy} onClick={() => void post("/api/admin/cases/" + encodeURIComponent(caseReference) + "/close", { reason: "resolution_confirmed" })} className="ml-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-800 disabled:cursor-not-allowed disabled:opacity-50">Close case</button>}
        </div>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
    </section>
  );
}
