import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { adminErrorResponse, adminJson, readAdminJson } from "@/lib/admin/http";
import { updateAdminCustomerStatus } from "@/lib/admin/customer-detail";

export async function POST(request:Request,{params}:{params:Promise<{customerId:string}>}){
 let context;
 try{
  context=await requireAdmin(request,"customers.status.manage");
  const {customerId}=await params;
  const body=await readAdminJson(request);
  const reason=requireHighRiskReason(body.reason);
  const result=await updateAdminCustomerStatus(customerId,{...body,reason});
  await auditAdminAction(context,{action:"CUSTOMER_STATUS_CHANGED",resourceType:"Customer",resourceId:customerId,success:true,reason,metadata:{beforeStatus:result.before.status,afterStatus:result.customer?.status??null}});
  return adminJson({customer:result.customer});
 }catch(error){
  if(context) await auditAdminAction(context,{action:"CUSTOMER_STATUS_CHANGE_FAILED",resourceType:"Customer",success:false,reason:"Administrative customer status change failed",metadata:{error:error instanceof Error?error.name:"unknown"}}).catch(()=>undefined);
  return adminErrorResponse(error);
 }
}
