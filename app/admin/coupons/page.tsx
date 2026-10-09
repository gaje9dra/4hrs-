import { requireAdmin } from "@/lib/admin/authorization";
import { CouponManager } from "@/components/admin/coupon-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCouponsPage() {
  await requireAdmin(undefined, "coupons.read");
  return <section className="space-y-8">
    <header><p className="text-sm font-black uppercase tracking-[0.2em]">Commerce promotions</p><h2 className="text-4xl font-black uppercase">Discount Coupons</h2><p className="mt-2 max-w-3xl">Create and manage percentage coupons with expiry dates and total redemption limits. Coupon changes are permission-gated and audited.</p></header>
    <CouponManager />
  </section>;
}
