import { requireAdmin } from "@/lib/admin/authorization";
import { createAdminUser, listAdminUsers } from "@/lib/admin/application";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import { requireHighRiskReason } from "@/lib/admin/authorization";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request){try{await requireAdmin(request,"admin.users.read");return adminJson({items:await listAdminUsers()});}catch(e){return adminErrorResponse(e);}}
export async function POST(request:Request){try{const context=await requireAdmin(request,"admin.users.manage");consumeAdminRateLimit(context.adminUser.id);assertAdminSameOrigin(request);const body=await readAdminJson(request);requireHighRiskReason(body.reason);return adminJson({adminUser:await createAdminUser(context,{email:typeof body.email==="string"?body.email:"",roles:body.roles,reason:body.reason})},{status:201});}catch(e){return adminErrorResponse(e);}}
