import { requireAdmin } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { getAdminCustomerDetail } from "@/lib/admin/customer-detail";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request,{params}:{params:Promise<{customerId:string}>}){
 let context;
 try{
  context=await requireAdmin(request,"customers.read");
  const {customerId}=await params;
  const detail=await getAdminCustomerDetail(customerId,context.permissions);
  if(context.permissions.has("customers.financial.read")||context.permissions.has("customers.address.read")||context.permissions.has("customers.case.read")){
   await auditAdminAction(context,{action:"CUSTOMER_SENSITIVE_ACCESS",resourceType:"Customer",resourceId:customerId,success:true,reason:"Authorized customer detail access",metadata:{financial:context.permissions.has("customers.financial.read"),address:context.permissions.has("customers.address.read"),cases:context.permissions.has("customers.case.read")}});
  }
  return adminJson({customer:detail});
 }catch(error){
  if(context) await auditAdminAction(context,{action:"CUSTOMER_DETAIL_ACCESS_FAILED",resourceType:"Customer",success:false,reason:"Customer detail access failed",metadata:{error:error instanceof Error?error.name:"unknown"}}).catch(()=>undefined);
  return adminErrorResponse(error);
 }
}
