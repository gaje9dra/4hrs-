import { requireAdmin } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { adminErrorResponse, adminJson, readAdminJson } from "@/lib/admin/http";
import { updateAdminCustomerProfile } from "@/lib/admin/customer-detail";

export async function PATCH(request:Request,{params}:{params:Promise<{customerId:string}>}){
 let context;
 try{
  context=await requireAdmin(request,"customers.update");
  const {customerId}=await params;
  const body=await readAdminJson(request);
  const result=await updateAdminCustomerProfile(customerId,body);
  await auditAdminAction(context,{action:"CUSTOMER_PROFILE_UPDATED",resourceType:"Customer",resourceId:customerId,success:true,reason:"Administrative profile update",metadata:{changedFields:["displayName"],before:{displayName:result.before.displayName},after:{displayName:result.customer?.displayName??null}}});
  return adminJson({customer:result.customer});
 }catch(error){
  if(context) await auditAdminAction(context,{action:"CUSTOMER_PROFILE_UPDATE_FAILED",resourceType:"Customer",success:false,reason:"Administrative profile update failed",metadata:{error:error instanceof Error?error.name:"unknown"}}).catch(()=>undefined);
  return adminErrorResponse(error);
 }
}
