import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { listAdminCancellations, parsePostOrderQuery } from "@/lib/admin/post-order";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request){try{const context=await requireAdmin(request,"cancellation.read");const q=parsePostOrderQuery(new URL(request.url));return adminJson(await listAdminCancellations(q,context.permissions.has("customers.read")));}catch(e){return adminErrorResponse(e);}}