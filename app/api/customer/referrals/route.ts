import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { authJson } from "@/lib/auth/http";
import { getReferralDashboard } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const current = await requireCurrentCustomer(request);
    return authJson({ dashboard: await getReferralDashboard(current.customer.id) });
  } catch (error) {
    if (isAuthenticationError(error)) return authJson({ error: { code: error.code, message: error.publicMessage } }, { status: 401 });
    return authJson({ error: { code: "REFERRAL_UNAVAILABLE", message: "Referral information is temporarily unavailable." } }, { status: 503 });
  }
}
