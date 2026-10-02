import { requireAdmin } from "@/lib/admin/authorization";
import { getAdminUser, updateAdminUser } from "@/lib/admin/application";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
export const dynamic="force-dynamic"; export const revalidate=0;
export async function GET(request:Request,{params}:{params:Promise<{adminId:string}>}){try{await requireAdmin(request,"admin.users.read");const id=(await params).adminId.trim();if(!id)return adminJson({error:{code:"INVALID_REQUEST",message:"Administrator ID is required."}},{status:400});return adminJson({adminUser:await getAdminUser(id)});}catch(e){return adminErrorResponse(e);}}
export async function PATCH(request:Request,{params}:{params:Promise<{adminId:string}>}){try{const context=await requireAdmin(request,"admin.users.manage");assertAdminSameOrigin(request);const body=await readAdminJson(request);const id=(await params).adminId.trim();return adminJson({adminUser:await updateAdminUser(context,{id,expectedVersion:body.expectedVersion,status:body.status,roles:body.roles,reason:body.reason})});}catch(e){return adminErrorResponse(e);}}
