"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Dashboard = {
  referralCode: string;
  referralPath: string;
  stats: { total: number; awaitingOrder: number; awaitingPaymentReview: number; rewarded: number };
  incomingReferral: null | { status: string; registeredAt: string; paymentVerifiedAt: string | null; rewardIssuedAt: string | null; hasQualifyingOrder: boolean; registrationRewardIssued: boolean; paymentRewardIssued: boolean };
  referrals: Array<{
    id: string; invitee: string; status: string; registeredAt: string; paymentVerifiedAt: string | null; deliveredAt: string | null; rewardIssuedAt: string | null;
    hasQualifyingOrder: boolean; registrationRewardIssued: boolean; paymentRewardIssued: boolean;
  }>;
  coupons: Array<{ id: string; code: string; discountPercent: number; status: string; expiresAt: string; createdAt: string }>;
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function title(value: string) { if (value === "AWAITING_DELIVERY") return "Payment reward pending"; return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function ReferralDashboard({ dashboard, referralUrl }: { dashboard: Dashboard; referralUrl: string }) {
  const [notice, setNotice] = useState("");
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Copied to clipboard."); }
    catch { setNotice("Copy failed. Select and copy the referral link or coupon manually."); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "Join 4HRS+", text: "Join 4HRS+ using my referral link.", url: referralUrl }); return; }
      catch { /* User cancelled the native share sheet. */ }
    }
    await copy(referralUrl);
  }
  return <div className="space-y-8">
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
      <div className="border-4 border-black bg-primary-yellow p-6 shadow-hard-md">
        <p className="text-xs font-900 uppercase tracking-[0.2em]">Refer a friend</p>
        <h2 className="mt-3 text-3xl font-900 uppercase">Give 14%. Earn 25%.</h2>
        <p className="mt-3 text-sm leading-6">When a new customer joins through your referral, you both receive a 14% coupon. After their first eligible order has a server-verified successful payment, you both receive an additional 25% coupon.</p>
        <div className="mt-5 break-all border-2 border-black bg-white p-3 font-bold">{referralUrl}</div>
        <div className="mt-4 flex flex-wrap gap-3"><Button variant="primary" onClick={() => void copy(referralUrl)}>Copy link</Button><Button variant="outline" onClick={() => void share()}>Share link</Button></div>
        <p role="status" className="mt-3 text-sm font-bold">{notice}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Total referrals", dashboard.stats.total],
          ["Awaiting order", dashboard.stats.awaitingOrder],
          ["Awaiting payment review", dashboard.stats.awaitingPaymentReview],
          ["Rewards earned", dashboard.stats.rewarded],
        ].map(([label,value]) => <div key={label} className="border-2 border-black bg-white p-4 shadow-hard-sm"><p className="text-xs font-900 uppercase">{label}</p><p className="mt-2 text-3xl font-900">{value}</p></div>)}
      </div>
    </section>
    {dashboard.incomingReferral && <section className="border-4 border-black bg-white p-5 shadow-hard-sm">
      <h2 className="text-2xl font-900 uppercase">Your referral progress</h2>
      <p className="mt-2 text-sm">You joined through a referral on {date(dashboard.incomingReferral.registeredAt)}. Your registration reward: <strong>{dashboard.incomingReferral.registrationRewardIssued ? "14% coupon issued" : "Pending"}</strong>.</p>
      <p className="mt-2 text-sm">First eligible order: <strong>{dashboard.incomingReferral.hasQualifyingOrder ? "Order recorded" : "Not yet recorded"}</strong>{dashboard.incomingReferral.paymentVerifiedAt ? ` · Payment verified ${date(dashboard.incomingReferral.paymentVerifiedAt)}` : ""}.</p>
      <p className="mt-2 text-sm">25% payment reward: <strong>{dashboard.incomingReferral.paymentRewardIssued ? "Issued" : dashboard.incomingReferral.hasQualifyingOrder ? "Awaiting payment/refund eligibility review" : "Earned after the first eligible order has verified successful payment"}</strong>{dashboard.incomingReferral.rewardIssuedAt ? ` · ${date(dashboard.incomingReferral.rewardIssuedAt)}` : ""}.</p>
    </section>}
    <section>
      <h2 className="mb-4 text-2xl font-900 uppercase">My referrals</h2>
      <div className="overflow-x-auto border-4 border-black bg-white">
        <table className="w-full min-w-[740px] text-left"><thead className="border-b-4 border-black bg-muted text-xs uppercase"><tr>{["Invited customer","Joined","Status","Order progress","Rewards"].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead>
          <tbody>{dashboard.referrals.map(row=><tr key={row.id} className="border-b-2 border-black last:border-0"><td className="p-3 font-bold">{row.invitee}</td><td className="p-3">{date(row.registeredAt)}</td><td className="p-3">{title(row.status)}</td><td className="p-3">{row.hasQualifyingOrder ? "Order placed" : "Not yet eligible"}{row.paymentVerifiedAt&&<div className="text-xs">Payment verified {date(row.paymentVerifiedAt)}</div>}</td><td className="p-3 text-sm">14%: {row.registrationRewardIssued ? "Issued" : "—"}<div>25%: {row.paymentRewardIssued ? "Issued" : row.hasQualifyingOrder ? "Awaiting payment review" : "After first eligible payment"}</div></td></tr>)}</tbody>
        </table>
        {dashboard.referrals.length===0&&<p className="p-6 text-sm">No referrals yet. Share your link to get started.</p>}
      </div>
    </section>
    <section>
      <h2 className="mb-4 text-2xl font-900 uppercase">My referral coupons</h2>
      <div className="overflow-x-auto border-4 border-black bg-white">
        <table className="w-full min-w-[580px] text-left"><thead className="border-b-4 border-black bg-muted text-xs uppercase"><tr>{["Coupon","Discount","Status","Expires"].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead>
          <tbody>{dashboard.coupons.map(coupon=><tr key={coupon.id} className="border-b-2 border-black last:border-0"><td className="p-3"><strong>{coupon.code}</strong><button className="ml-2 underline text-xs" onClick={() => void copy(coupon.code)}>Copy</button></td><td className="p-3 font-bold">{coupon.discountPercent}% OFF</td><td className="p-3">{title(coupon.status)}</td><td className="p-3">{date(coupon.expiresAt)}</td></tr>)}</tbody>
        </table>
        {dashboard.coupons.length===0&&<p className="p-6 text-sm">Referral coupons you earn will appear here.</p>}
      </div>
    </section>
  </div>;
}
