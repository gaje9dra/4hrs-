import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { listAdminOrders, parseAdminOrderQuery } from "@/lib/admin/orders";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  try{
    const context=await requireAdmin(request,"orders.read");
    void context;
    return adminJson(await listAdminOrders(parseAdminOrderQuery(new URL(request.url))));
  }catch(error){return adminErrorResponse(error);}
}
