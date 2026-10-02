import {db} from "@/lib/db/client";
export type CaseClient=typeof db;
export const caseInclude={order:{select:{orderNumber:true}},shipment:{select:{shipmentReference:true}},returnRequest:{select:{returnReference:true}},cancellationRequest:{select:{cancellationReference:true}},notes:{orderBy:{createdAt:"asc" as const}}};
export async function getCaseByReference(reference:string,customerId?:string){return db.case.findFirst({where:{caseReference:reference,...(customerId?{customerId}:{})},include:caseInclude});}
export async function getCaseById(id:string){return db.case.findUnique({where:{id},include:caseInclude});}
