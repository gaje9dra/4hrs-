import { createReturnsApplication } from "@/lib/returns/application";
import { returnsError,returnsJson } from "@/lib/returns/http";
import { requireCurrentCustomer } from "@/lib/auth/context";
export const dynamic="force-dynamic";export const revalidate=0;
export async function GET(request:Request,{params}:{params:Promise<{orderId:string}>}){try{await requireCurrentCustomer(request);const {orderId}=await params;return returnsJson(await createReturnsApplication().getCustomerExceptionSummary({orderNumber:orderId,request}));}catch(e){return returnsError(e);}}
