import { requireAdmin } from "@/lib/admin/authorization";
import { assertAdminSameOrigin } from "@/lib/admin/http";
import { createReturnsApplication } from "@/lib/returns/application";
import { ReturnDomainError } from "@/lib/returns/errors";
import { returnsError,returnsJson,readReturnsJson } from "@/lib/returns/http";
type InspectionOutcome="ACCEPTED"|"PARTIALLY_ACCEPTED"|"REJECTED";
function outcome(value:unknown):InspectionOutcome{if(value==="ACCEPTED"||value==="PARTIALLY_ACCEPTED"||value==="REJECTED")return value;throw new ReturnDomainError("INVALID_REQUEST","Inspection outcome is invalid.");}
export async function POST(request:Request,{params}:{params:Promise<{reference:string}>}){try{const context=await requireAdmin(request,"return.inspect");assertAdminSameOrigin(request);const b=await readReturnsJson(request);const p=await params;return returnsJson({returnRequest:await createReturnsApplication().inspectReturn({reference:p.reference,receivedQuantity:Number(b.receivedQuantity),acceptedQuantity:Number(b.acceptedQuantity),rejectedQuantity:Number(b.rejectedQuantity),outcome:outcome(b.outcome),reason:typeof b.reason==="string"?b.reason:undefined,request,adminContext:context})});}catch(e){return returnsError(e);}}