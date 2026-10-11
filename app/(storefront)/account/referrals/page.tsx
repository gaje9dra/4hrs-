import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { getReferralDashboard } from "@/lib/referrals/service";
import { absoluteSiteUrl } from "@/config/site";
import { ReferralDashboard } from "@/components/storefront/referral-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Refer & Earn | 4HRS+", description: "Track your 4HRS+ referrals and rewards.", robots: { index: false, follow: false, noarchive: true } };

export default async function AccountReferralsPage() {
  let current;
  try { current = await requireCurrentCustomer(); }
  catch { redirect("/login?next=%2Faccount%2Freferrals"); }
  const dashboard = await getReferralDashboard(current.customer.id);
  const referralUrl = new URL(dashboard.referralPath, absoluteSiteUrl("/")).toString();
  return <Container width="standard" className="py-10 sm:py-14 lg:py-20">
    <header className="mb-8 border-b-4 border-border pb-6">
      <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">Customer / Rewards</p>
      <h1 className="mt-3 uppercase">Refer &amp; Earn</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6">Invite new customers, track their progress, and see each referral coupon in one place.</p>
    </header>
    <ReferralDashboard dashboard={dashboard} referralUrl={referralUrl} />
  </Container>;
}
