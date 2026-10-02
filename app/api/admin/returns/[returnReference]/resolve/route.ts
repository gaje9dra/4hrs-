import { createReturnsApplication } from "@/lib/returns/application";
import { ReturnDomainError } from "@/lib/returns/errors";
import { returnsError,returnsJson,readReturnsJson } from "@/lib/returns/http";
type ResolutionType="REFUND"|"REPLACEMENT"|"STORE_CREDIT"|"REJECTED"|"PARTIAL_REFUND";
function resolutionType(value:unknown):ResolutionType{if(value==="REFUND"||value==="REPLACEMENT"||value==="STORE_CREDIT"||value==="REJECTED"||value==="PARTIAL_REFUND")return value;throw new ReturnDomainError("INVALID_REQUEST","Resolution type is invalid.");}
export async function POST(request:Request,{params}:{params:Promise<{returnReference:string}>}){try{const b=await readReturnsJson(request);const p=await params;return returnsJson({returnRequest:await createReturnsApplication().resolveReturn({reference:p.returnReference,type:resolutionType(b.type),refundAmount:typeof b.refundAmount==="string"?b.refundAmount:undefined,note:typeof b.note==="string"?b.note:undefined,request})});}catch(e){return returnsError(e);}}
