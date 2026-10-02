import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { listAdminPayments, parseAdminPaymentQuery } from "@/lib/admin/payments";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request){try{const context=await requireAdmin(request,"payments.read");const query=parseAdminPaymentQuery(new URL(request.url));return adminJson(await listAdminPayments(query,context.permissions.has("payments.view_sensitive")));}catch(error){return adminErrorResponse(error);}}