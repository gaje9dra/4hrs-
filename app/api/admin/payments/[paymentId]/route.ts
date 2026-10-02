import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { getAdminPayment } from "@/lib/admin/payments";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request,{params}:{params:Promise<{paymentId:string}>}){try{const context=await requireAdmin(request,"payments.read");const id=(await params).paymentId;return adminJson({payment:await getAdminPayment(id,context.permissions.has("payments.view_sensitive"),context.permissions.has("payments.audit.read"))});}catch(error){return adminErrorResponse(error);}}