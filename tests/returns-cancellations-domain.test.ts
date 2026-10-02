import test from "node:test";
import assert from "node:assert/strict";
import { assertCancellationTransition, assertReturnTransition, cancellationEligibility, returnEligibility, validateInspection, validateReturnQuantity } from "@/lib/returns/domain";
import { ReturnDomainError } from "@/lib/returns/errors";

test("cancellation is eligible before fulfillment/shipment",()=>assert.equal(cancellationEligibility({orderStatus:"PENDING",fulfillmentStatus:"PENDING",hasShipment:false,shipmentStatus:null}),"eligible"));
test("cancellation requires review after fulfillment begins",()=>assert.equal(cancellationEligibility({orderStatus:"CONFIRMED",fulfillmentStatus:"SUBMITTED",hasShipment:false,shipmentStatus:null}),"requires_review"));
test("delivered orders cannot be cancelled",()=>assert.equal(cancellationEligibility({orderStatus:"CONFIRMED",fulfillmentStatus:"COMPLETED",hasShipment:true,shipmentStatus:"DELIVERED"}),"no_longer_possible"));
test("return eligibility requires delivered shipment and window",()=>{
 const deliveredAt=new Date("2026-10-01T00:00:00Z");
 assert.equal(returnEligibility({orderStatus:"CONFIRMED",paymentSucceeded:true,shipmentStatus:"DELIVERED",deliveredAt,now:new Date("2026-10-05T00:00:00Z"),returnWindowDays:7}),"eligible");
 assert.equal(returnEligibility({orderStatus:"CONFIRMED",paymentSucceeded:true,shipmentStatus:"DELIVERED",deliveredAt,now:new Date("2026-10-09T00:00:00Z"),returnWindowDays:7}),"outside_window");
 assert.equal(returnEligibility({orderStatus:"CONFIRMED",paymentSucceeded:true,shipmentStatus:"IN_TRANSIT",deliveredAt:null,now:new Date(),returnWindowDays:7}),"undelivered");
});
test("state machines reject invalid and terminal transitions",()=>{
 assert.doesNotThrow(()=>assertCancellationTransition("REQUESTED","APPROVED"));
 assert.throws(()=>assertCancellationTransition("COMPLETED","APPROVED"),ReturnDomainError);
 assert.doesNotThrow(()=>assertReturnTransition("RETURN_RECEIVED","INSPECTION_PENDING"));
 assert.throws(()=>assertReturnTransition("RESOLVED","UNDER_REVIEW"),ReturnDomainError);
});
test("inspection quantities are bounded by returned quantity",()=>{
 assert.doesNotThrow(()=>validateInspection(3,2,1,3));
 assert.throws(()=>validateInspection(4,3,1,3),ReturnDomainError);
 assert.throws(()=>validateInspection(3,3,1,3),ReturnDomainError);
});
test("return quantity must be positive integer",()=>{
 assert.doesNotThrow(()=>validateReturnQuantity(1));
 assert.throws(()=>validateReturnQuantity(0),ReturnDomainError);
 assert.throws(()=>validateReturnQuantity(1.5),ReturnDomainError);
});
