import { ReferralStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { listAdminReferrals } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "referrals.read");
    const url = new URL(request.url);
    const allowed = new Set(["search", "status", "page", "pageSize"]);
    for (const key of url.searchParams.keys()) if (!allowed.has(key)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Unsupported referral query parameter." } }, { status: 400 });
    const statusValue = url.searchParams.get("status");
    const validStatuses = Object.values(ReferralStatus) as string[];
    if (statusValue && !validStatuses.includes(statusValue)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Invalid referral status." } }, { status: 400 });
    const numberParam = (raw: string | null, fallback: number, max: number) => {
      if (raw === null) return fallback;
      if (!/^\d+$/.test(raw)) return null;
      const value = Number(raw);
      return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : null;
    };
    const page = numberParam(url.searchParams.get("page"), 1, 1000000);
    const pageSize = numberParam(url.searchParams.get("pageSize"), 25, 100);
    if (page === null || pageSize === null) return adminJson({ error: { code: "INVALID_REQUEST", message: "Invalid pagination." } }, { status: 400 });
    return adminJson(await listAdminReferrals({ search: url.searchParams.get("search") ?? undefined, status: statusValue as ReferralStatus | undefined, page, pageSize }));
  } catch (error) { return adminErrorResponse(error); }
}
