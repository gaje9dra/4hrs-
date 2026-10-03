"use client";

import { useState } from "react";

type Preference = { category: "MARKETING_PROMOTIONAL"; channel: "EMAIL"; state: "OPTED_IN" | "OPTED_OUT"; version: number };
type AuditItem = { category: string; channel: string; previousState: string | null; newState: string; source: string; actorType: string; reason: string | null; createdAt: string };

export default function CustomerCommunicationPreferencesAdmin({ customerId, canManage, canAudit, initialPreference, initialAudit }: { customerId: string; canManage: boolean; canAudit: boolean; initialPreference: Preference; initialAudit: AuditItem[] | null }) {
  const [preference, setPreference] = useState<Preference>(initialPreference);
  const [audit, setAudit] = useState<AuditItem[] | null>(initialAudit);
  const [reason, setReason] = useState("");
  const [basis, setBasis] = useState("CUSTOMER_REQUEST");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(state: "OPTED_IN" | "OPTED_OUT") {
    if (!preference) return;
    if (reason.trim().length < 3) { setMessage("A reason is required."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/communication-preferences`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: preference.category, channel: preference.channel, state, expectedVersion: preference.version, idempotencyKey: crypto.randomUUID(), reason, basis: state === "OPTED_IN" ? basis : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Preference change failed.");
      setReason(""); setMessage("Saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preference change failed."); }
    finally { setBusy(false); }
  }

  return (
    <section className="border-4 border-black bg-white p-5 shadow-[6px_6px_0_0_#000]">
      <h3 className="text-2xl font-black uppercase">Communication preferences</h3>
      <p className="mt-2 text-sm">Transactional communication remains required. Marketing preference changes are separately controlled.</p>
      {preference ? <div className="mt-5 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black p-3">
          <div><strong className="uppercase">Promotional email</strong><p className="text-sm">Current: {preference.state} · version {preference.version}</p></div>
          {canManage ? <div className="flex gap-2"><button disabled={busy} onClick={() => void save("OPTED_OUT")} className="border-2 border-black px-3 py-2 font-black uppercase disabled:opacity-50">Opt out</button><button disabled={busy} onClick={() => void save("OPTED_IN")} className="border-2 border-black bg-[#f7d51d] px-3 py-2 font-black uppercase disabled:opacity-50">Opt in</button></div> : <span className="text-xs font-black uppercase">Read only</span>}
        </div>
        {canManage ? <div className="grid gap-3"><label className="grid gap-1 text-sm font-bold">Reason<textarea minLength={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className="border-2 border-black p-2" /></label><label className="grid gap-1 text-sm font-bold">Opt-in basis<select value={basis} onChange={(e) => setBasis(e.target.value)} className="border-2 border-black p-2"><option value="CUSTOMER_REQUEST">Explicit customer request</option></select></label></div> : null}
      </div> : null}
      {canAudit && audit ? <div className="mt-6 border-t-2 border-black pt-4"><h4 className="font-black uppercase">Preference audit</h4><div className="mt-3 space-y-2 text-sm">{audit.map((item, index) => <div key={index} className="border border-black p-2"><strong>{item.newState}</strong> · {item.actorType} · {new Date(item.createdAt).toLocaleString("en-IN")}{item.reason ? <p>{item.reason}</p> : null}</div>)}</div></div> : null}
      {message ? <p className="mt-3 border-2 border-black p-3 font-bold" role="status">{message}</p> : null}
    </section>
  );
}
