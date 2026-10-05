import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { getAdminPayment } from "@/lib/admin/payments";
import { consumeFinancialRateLimit, FINANCIAL_RATE_LIMITS } from "@/lib/payments/rate-limit";
import { PaymentError } from "@/lib/payments/errors";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request,{params}:{params:Promise<{paymentId:string}>}){try{const rate=await consumeFinancialRateLimit(FINANCIAL_RATE_LIMITS.adminFinancial,`admin:${request.headers.get("x-admin-id")??request.headers.get("authorization")??"unknown"}`);if(!rate.allowed)throw new PaymentError("PAYMENT_RATE_LIMITED","Administrative financial access rate limit exceeded.");const context=await requireAdmin(request,"payments.read");const id=(await params).paymentId;return adminJson({payment:await getAdminPayment(id,context.permissions.has("payments.view_sensitive"),context.permissions.has("payments.audit.read"))});}catch(error){return adminErrorResponse(error);}}