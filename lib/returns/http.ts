import { NextResponse } from "next/server";
import { ReturnDomainError } from "@/lib/returns/errors";
import { AdminError } from "@/lib/admin/errors";
export function returnsJson<T>(data:T,init:ResponseInit={}){return NextResponse.json(data,{...init,headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff","x-robots-tag":"noindex, nofollow, noarchive",...(init.headers??{})}});}
export function returnsError(error:unknown){
  if(error instanceof AdminError){const status=error.code==="ADMIN_REQUIRED"?401:error.code==="FORBIDDEN"?403:error.code==="CONFLICT"?409:error.code==="INVALID_REQUEST"?400:503;return returnsJson({error:{code:error.code,message:error.message}},{status});}
  const e=error instanceof ReturnDomainError?error:null;const code=e?.code??"DATABASE_ERROR";
  const status=code==="AUTHENTICATION_REQUIRED"||code==="ADMIN_REQUIRED"?401:code==="FORBIDDEN"?403:code==="ORDER_NOT_FOUND"||code==="RETURN_NOT_FOUND"?404:code==="RETURN_NOT_ELIGIBLE"||code==="CANCELLATION_NOT_ELIGIBLE"||code==="RETURN_QUANTITY_EXCEEDED"?409:code==="DATABASE_ERROR"||code==="REFUND_UNAVAILABLE"?503:400;
  return returnsJson({error:{code,message:e?.message??"The request could not be completed safely."}},{status});
}
export async function readReturnsJson(request:Request){const length=request.headers.get("content-length");if(length&&Number(length)>32*1024)throw new ReturnDomainError("INVALID_REQUEST","Request is invalid.");try{const body=await request.json();if(!body||typeof body!=="object"||Array.isArray(body))throw new Error();return body as Record<string,unknown>;}catch{throw new ReturnDomainError("INVALID_REQUEST","Request is invalid.");}}
