import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";
import { enqueueNotificationEvent } from "@/lib/notifications/service";
export type ReturnsClient=PrismaClient|Prisma.TransactionClient;
export type ReturnsOrder = Prisma.OrderGetPayload<{include:{items:true,payment:true,fulfillment:{include:{shipments:true}},shipments:true,cancellationRequests:true,returnRequests:{include:{items:true,shipment:true,inspection:true,resolution:true}}}}>;
export type ReturnRecord = Prisma.ReturnRequestGetPayload<{include:{items:{include:{orderItem:true}},order:true,shipment:true,inspection:true,resolution:true}}>;
export type CancellationRecord = Prisma.CancellationRequestGetPayload<{include:{order:true}}>;

export function createReturnsRepository(client:ReturnsClient=db){
  return {
    getOrder(id:string,customerId:string){return client.order.findFirst({where:{id,customerId},include:{items:true,payment:true,fulfillment:{include:{shipments:true}},shipments:true,cancellationRequests:true,returnRequests:{include:{items:true,shipment:true,inspection:true,resolution:true}}}});},
    getOrderByNumber(orderNumber:string,customerId:string){return client.order.findFirst({where:{orderNumber,customerId},include:{items:true,payment:true,fulfillment:{include:{shipments:true}},shipments:true,cancellationRequests:true,returnRequests:{include:{items:true,shipment:true,inspection:true,resolution:true}}}});},
    getReturn(reference:string,customerId:string){return client.returnRequest.findFirst({where:{returnReference:reference,customerId},include:{items:{include:{orderItem:true}},order:true,shipment:true,inspection:true,resolution:true}});},
    getCancellation(reference:string,customerId:string){return client.cancellationRequest.findFirst({where:{cancellationReference:reference,customerId},include:{order:true}});},
    listActiveReturnQuantities(orderItemIds:string[]){return client.returnItem.findMany({where:{orderItemId:{in:orderItemIds},returnRequest:{status:{notIn:["REJECTED"]}}},select:{orderItemId:true,quantity:true}});},
    audit(data:Prisma.CommerceExceptionAuditEventUncheckedCreateInput){return client.commerceExceptionAuditEvent.create({data});},
    async notify(data:{customerId:string;orderId?:string|null;returnRequestId?:string|null;type:Prisma.NotificationEventUncheckedCreateInput["type"];payload?:Prisma.InputJsonValue|null;idempotencyKey?:string|null;correlationId?:string|null}){
      const idempotencyKey = data.idempotencyKey ?? [data.type,data.customerId,data.orderId ?? "none",data.returnRequestId ?? "none"].join(":");
      return enqueueNotificationEvent(client, {
        customerId:data.customerId,
        orderId:data.orderId,
        returnRequestId:data.returnRequestId,
        type:data.type,
        payload:data.payload ?? null,
        idempotencyKey,
        correlationId:data.correlationId,
      });
    },
  };
}
