import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { listAdminCustomers, parseAdminCustomerQuery } from "@/lib/admin/customer-query";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
 try{
  const context=await requireAdmin(request,"customers.read");
  const url=new URL(request.url);
  if(url.searchParams.get("search") && !context.permissions.has("customers.search")) throw new AdminError("FORBIDDEN","Customer search is not authorized.");
  const query=parseAdminCustomerQuery(url,context.permissions);
  return adminJson(await listAdminCustomers(query));
 }catch(error){return adminErrorResponse(error);}
}
