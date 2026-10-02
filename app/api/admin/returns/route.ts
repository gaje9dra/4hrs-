import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { listAdminReturns, parsePostOrderQuery } from "@/lib/admin/post-order";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request){try{const context=await requireAdmin(request,"return.read");const q=parsePostOrderQuery(new URL(request.url));return adminJson(await listAdminReturns(q,context.permissions.has("customers.read")));}catch(e){return adminErrorResponse(e);}}