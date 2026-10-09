import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, readAdminJson, assertAdminSameOrigin } from "@/lib/admin/http";
import { listDiscountCoupons, createDiscountCoupon, updateDiscountCoupon } from "@/lib/admin/coupons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "coupons.read");
    const search = new URL(request.url).searchParams.get("search") ?? "";
    return adminJson({ items: await listDiscountCoupons(search) });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAdmin(request, "coupons.manage");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    return adminJson({ coupon: await createDiscountCoupon(context, body) }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireAdmin(request, "coupons.manage");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    return adminJson({ coupon: await updateDiscountCoupon(context, body) });
  } catch (error) { return adminErrorResponse(error); }
}
