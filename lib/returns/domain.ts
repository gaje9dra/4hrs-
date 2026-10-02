import { Prisma } from "@prisma/client";
import { ReturnDomainError } from "@/lib/returns/errors";

export type CancellationLifecycle = "REQUESTED"|"APPROVED"|"REJECTED"|"PROCESSING"|"COMPLETED"|"FAILED"|"REQUIRES_REVIEW";
export type ReturnLifecycle = "REQUESTED"|"UNDER_REVIEW"|"APPROVED"|"REJECTED"|"RETURN_IN_TRANSIT"|"RETURN_RECEIVED"|"INSPECTION_PENDING"|"INSPECTED"|"RESOLUTION_PENDING"|"RESOLVED"|"FAILED";
export type ReturnReason = "WRONG_ITEM"|"DAMAGED"|"DEFECTIVE"|"SIZE_OR_FIT"|"NOT_AS_EXPECTED"|"CHANGED_MIND"|"OTHER";

const CANCELLATION_TRANSITIONS: Record<CancellationLifecycle, readonly CancellationLifecycle[]> = {
  REQUESTED:["APPROVED","REJECTED","REQUIRES_REVIEW"], APPROVED:["PROCESSING"], REJECTED:[], PROCESSING:["COMPLETED","FAILED"], COMPLETED:[], FAILED:["REQUIRES_REVIEW"], REQUIRES_REVIEW:["APPROVED","REJECTED"], 
};
const RETURN_TRANSITIONS: Record<ReturnLifecycle, readonly ReturnLifecycle[]> = {
  REQUESTED:["UNDER_REVIEW","APPROVED","REJECTED"], UNDER_REVIEW:["APPROVED","REJECTED"], APPROVED:["RETURN_IN_TRANSIT","RETURN_RECEIVED","FAILED"], REJECTED:[],
  RETURN_IN_TRANSIT:["RETURN_RECEIVED","FAILED"], RETURN_RECEIVED:["INSPECTION_PENDING"], INSPECTION_PENDING:["INSPECTED","FAILED"], INSPECTED:["RESOLUTION_PENDING"], RESOLUTION_PENDING:["RESOLVED","FAILED"], RESOLVED:[], FAILED:["UNDER_REVIEW"]
};
export function assertCancellationTransition(current: CancellationLifecycle,next: CancellationLifecycle){
  if(!CANCELLATION_TRANSITIONS[current]?.includes(next)) throw new ReturnDomainError("CANCELLATION_INVALID_TRANSITION","Cancellation transition is not allowed.");
}
export function assertReturnTransition(current: ReturnLifecycle,next: ReturnLifecycle){
  if(!RETURN_TRANSITIONS[current]?.includes(next)) throw new ReturnDomainError("RETURN_INVALID_TRANSITION","Return transition is not allowed.");
}
export type CancellationEligibilityInput = { orderStatus:"PENDING"|"CONFIRMED"; fulfillmentStatus:"PENDING"|"SUBMITTED"|"FAILED"|"COMPLETED"|null; hasShipment:boolean; shipmentStatus:"CREATED"|"IN_TRANSIT"|"OUT_FOR_DELIVERY"|"DELIVERED"|"DELIVERY_FAILED"|"RETURNED"|null; };
export type CancellationEligibility = "eligible"|"requires_review"|"no_longer_possible";
export function cancellationEligibility(input: CancellationEligibilityInput): CancellationEligibility {
  if(input.shipmentStatus==="DELIVERED" || input.shipmentStatus==="RETURNED") return "no_longer_possible";
  if(input.orderStatus==="PENDING" && (input.fulfillmentStatus===null || input.fulfillmentStatus==="PENDING") && !input.hasShipment) return "eligible";
  return "requires_review";
}
export type ReturnEligibilityInput = { orderStatus:"PENDING"|"CONFIRMED"; paymentSucceeded:boolean; shipmentStatus:"CREATED"|"IN_TRANSIT"|"OUT_FOR_DELIVERY"|"DELIVERED"|"DELIVERY_FAILED"|"RETURNED"|null; deliveredAt:Date|null; now:Date; returnWindowDays:number; };
export type ReturnEligibility = "eligible"|"outside_window"|"undelivered"|"ineligible";
export function returnEligibility(input: ReturnEligibilityInput): ReturnEligibility {
  if(input.orderStatus!=="CONFIRMED" || !input.paymentSucceeded) return "ineligible";
  if(input.shipmentStatus!=="DELIVERED" || !input.deliveredAt) return "undelivered";
  if(input.returnWindowDays<0 || input.now.getTime() > input.deliveredAt.getTime()+input.returnWindowDays*86400000) return "outside_window";
  return "eligible";
}
export function validateReturnQuantity(quantity:number){ if(!Number.isSafeInteger(quantity)||quantity<1) throw new ReturnDomainError("RETURN_QUANTITY_INVALID","Return quantity must be a positive integer."); }
export function validateInspection(received:number,accepted:number,rejected:number,returned:number){
  for(const n of [received,accepted,rejected]) if(!Number.isSafeInteger(n)||n<0) throw new ReturnDomainError("RETURN_INSPECTION_INVALID","Inspection quantities are invalid.");
  if(received<1 || accepted+rejected!==received || received>returned) throw new ReturnDomainError("RETURN_INSPECTION_INVALID","Inspection quantities must not exceed the returned quantity.");
}
export function refundAmountForItems(items:{quantity:number;unitPrice:Prisma.Decimal}[],requestedQuantities:Map<string,number>,currency:string){
  let amount=new Prisma.Decimal(0);
  for(const [id,qty] of requestedQuantities){ const item=items.find(x=>x.quantity>=qty && id); if(!item) throw new ReturnDomainError("RETURN_ITEM_INVALID","Return item is invalid."); amount=amount.add(item.unitPrice.mul(qty)); }
  if(!/^[A-Z]{3}$/.test(currency)) throw new ReturnDomainError("INVALID_REQUEST","Currency is invalid.");
  return amount;
}
