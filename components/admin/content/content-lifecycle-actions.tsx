"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContentLifecycleActions({ id, version, status, permissions }: { id: string; version: number; status: string; permissions: string[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  async function run(action: string, targetRevisionVersion?: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/content/"+id+"/transition", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, expectedVersion: version, targetRevisionVersion, reason }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? "Lifecycle operation failed.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Lifecycle operation failed."); }
    finally { setBusy(false); }
  }
  const highRisk = ["publish","unpublish","schedule","rollback","archive"].includes(status === "SCHEDULED" ? "schedule" : "");
  void highRisk;
  return <section className="border-4 border-black bg-white p-5"><div className="flex flex-wrap gap-2">
    {status === "DRAFT" && permissions.includes("content.review") ? <button disabled={busy} onClick={() => run("submit_review")} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">Submit review</button> : null}
    {status === "IN_REVIEW" && permissions.includes("content.review") ? <button disabled={busy} onClick={() => run("reject")} className="border-2 border-black px-3 py-2 font-bold uppercase">Reject</button> : null}
    {status === "IN_REVIEW" && permissions.includes("content.approve") ? <button disabled={busy} onClick={() => run("approve")} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">Approve</button> : null}
    {status === "APPROVED" && permissions.includes("content.publish") ? <button disabled={busy} onClick={() => run("publish")} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">Publish</button> : null}
    {status === "APPROVED" && permissions.includes("content.schedule") ? <button disabled={busy} onClick={() => run("schedule")} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">Schedule</button> : null}
    {status === "SCHEDULED" && permissions.includes("content.publish") ? <button disabled={busy} onClick={() => run("publish")} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-bold uppercase">Publish now</button> : null}
    {status === "PUBLISHED" && permissions.includes("content.publish") ? <button disabled={busy} onClick={() => run("unpublish")} className="border-2 border-black bg-[#ff5a36] px-3 py-2 font-bold uppercase">Unpublish</button> : null}
    {status !== "ARCHIVED" && permissions.includes("content.archive") ? <button disabled={busy} onClick={() => run("archive")} className="border-2 border-black bg-[#ff5a36] px-3 py-2 font-bold uppercase">Archive</button> : null}
  </div><div className="mt-4"><label className="block text-xs font-black uppercase">Reason / audit note for privileged transitions<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} className="mt-1 w-full border-2 border-black p-2"/></label></div>{error ? <p role="alert" className="mt-3 font-bold text-red-700">{error}</p> : null}</section>;
}