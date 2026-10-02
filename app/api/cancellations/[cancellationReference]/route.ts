import { createReturnsApplication } from "@/lib/returns/application";import { returnsError,returnsJson } from "@/lib/returns/http";
export const dynamic="force-dynamic";export const revalidate=0;
export async function GET(request:Request,{params}:{params:Promise<{cancellationReference:string}>}){try{const p=await params;return returnsJson({cancellation:await createReturnsApplication().getCustomerCancellation({reference:p.cancellationReference,request})});}catch(e){return returnsError(e);}}
