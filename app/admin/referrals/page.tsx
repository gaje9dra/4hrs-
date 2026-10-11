import { requireAdmin } from "@/lib/admin/authorization";
import { ReferralManager } from "@/components/admin/referral-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReferralsPage() {
  await requireAdmin(undefined, "referrals.read");
  return <section className="space-y-8">
    <header><p className="text-sm font-900 uppercase tracking-[0.2em]">Customer growth</p><h2 className="text-4xl font-900 uppercase">Refer &amp; Earn</h2><p className="mt-2 max-w-3xl">Inspect referral attribution, coupon issuance, payment verification, delivery state, and reward completion. This page is read-only; reward conditions cannot be overridden from the dashboard.</p></header>
    <ReferralManager />
  </section>;
}
