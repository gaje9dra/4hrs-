import { createReturnsApplication } from "@/lib/returns/application";
import { ReturnDomainError } from "@/lib/returns/errors";
import { returnsError,returnsJson,readReturnsJson } from "@/lib/returns/http";
import type { ReturnReason } from "@/lib/returns/domain";
type ReturnItemInput={orderItemReference:string;quantity:number};
function isReturnItem(value:unknown):value is ReturnItemInput{if(!value||typeof value!=="object")return false;const item=value as Record<string,unknown>;return typeof item.orderItemReference==="string"&&typeof item.quantity==="number";}
export async function POST(request:Request,{params}:{params:Promise<{orderId:string}>}){try{const b=await readReturnsJson(request);const items=Array.isArray(b.items)?b.items.filter(isReturnItem):[];if(!items.length)throw new ReturnDomainError("RETURN_ITEM_INVALID","Return items are invalid.");const p=await params;const result=await createReturnsApplication().requestReturn({orderNumber:p.orderId,items,reasonCode:b.reasonCode as ReturnReason,description:typeof b.description==="string"?b.description:undefined,request});return returnsJson({returnRequest:result},{status:201});}catch(e){return returnsError(e);}}
