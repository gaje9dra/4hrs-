import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, isValidAdminId } from "@/lib/admin/http";
import { getAdminOrder } from "@/lib/admin/orders";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request,{params}:{params:Promise<{orderId:string}>}){
  try{
    await requireAdmin(request,"orders.read");
    const id=(await params).orderId.trim();
    if(!isValidAdminId(id) && !/^ORD-[A-F0-9]{24}$/i.test(id)) return adminJson({error:{code:"INVALID_REQUEST",message:"Order identifier is invalid."}},{status:400});
    return adminJson({order:await getAdminOrder(id)});
  }catch(error){return adminErrorResponse(error);}
}
