"use client";
import { useEffect, useState } from "react";

type Referral = {
  id: string; referralCode: string; status: string; registeredAt: string; paymentVerifiedAt: string | null; deliveredAt: string | null; rewardIssuedAt: string | null;
  orderNumber: string | null; paymentStatus: string | null; paymentCompletedAt: string | null;
  referrer: { id: string; email: string; displayName: string | null };
  invited: { id: string; email: string; displayName: string | null };
  rewards: Array<{ type: string; recipientCustomerId: string; issuedAt: string; couponCode: string; couponStatus: string; couponExpiresAt: string }>;
};
type Result = { items: Referral[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
async function loadData(url: string): Promise<Result> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Referral data could not be loaded.");
  return body as Result;
}
function nice(value: string) { return value.replaceAll("_", " "); }
export function ReferralManager() {
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("");
  const [data,setData]=useState<Result|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (status) query.set("status", status);
    loadData("/api/admin/referrals?" + query.toString())
      .then((result) => {
        if (!cancelled) { setData(result); setError(""); }
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Could not load referral records.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [search, status]);
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="grid flex-1 gap-1 text-sm font-bold uppercase">Search<input className="border-2 border-black bg-white p-3" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Referral code, customer, or order"/></label>
      <label className="grid gap-1 text-sm font-bold uppercase">Status<select className="border-2 border-black bg-white p-3" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{["REGISTERED","AWAITING_ORDER","AWAITING_DELIVERY","AWAITING_PAYMENT_REVIEW","REWARDED","INELIGIBLE","CANCELLED"].map(s=><option key={s} value={s}>{nice(s)}</option>)}</select></label>
    </div>
    {error&&<p role="alert" className="border-2 border-black bg-red-100 p-3 font-bold">{error}</p>}
    {loading&&!data&&<p role="status">Loading referral records…</p>}
    {data&&<><p className="text-sm font-bold">{data.pagination.total} referral records</p><div className="overflow-x-auto border-4 border-black bg-white"><table className="w-full min-w-[1100px] text-left"><thead className="border-b-4 border-black bg-muted text-xs uppercase"><tr>{["Referral","Referrer","Invited customer","Order / payment","Verified payment / rewards","Coupons"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{data.items.map(r=><tr key={r.id} className="border-b-2 border-black last:border-0 align-top"><td className="p-3"><strong>{r.referralCode}</strong><div className="text-xs">{new Date(r.registeredAt).toLocaleDateString("en-IN")}</div><div className="text-xs">{nice(r.status)}</div></td><td className="p-3"><div>{r.referrer.displayName||"Customer"}</div><div className="text-xs">{r.referrer.email}</div></td><td className="p-3"><div>{r.invited.displayName||"Customer"}</div><div className="text-xs">{r.invited.email}</div></td><td className="p-3">{r.orderNumber||"—"}<div className="text-xs">Payment: {r.paymentStatus||"—"}</div><div className="text-xs">Verified: {r.paymentCompletedAt?new Date(r.paymentCompletedAt).toLocaleString("en-IN"):"—"}</div></td><td className="p-3"><div>Payment completed: {r.paymentCompletedAt?new Date(r.paymentCompletedAt).toLocaleString("en-IN"):"—"}</div><div>Reward issued: {r.rewardIssuedAt?new Date(r.rewardIssuedAt).toLocaleString("en-IN"):"—"}</div></td><td className="p-3 text-xs">{r.rewards.map(reward=><div key={reward.type+reward.recipientCustomerId} className="mb-2"><strong>{reward.type.replaceAll("_"," ")}</strong><div>{reward.couponCode} · {reward.couponStatus}</div><div>Expires {new Date(reward.couponExpiresAt).toLocaleDateString("en-IN")}</div></div>)}</td></tr>)}</tbody></table>{data.items.length===0&&<p className="p-6">No referrals match the current filters.</p>}</div></>}
  </div>;
}
