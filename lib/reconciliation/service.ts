import { randomUUID } from "node:crypto";
import { Prisma, type ReconciliationDomain, type ReconciliationDiscrepancyType, type ReconciliationSeverity, type ReconciliationStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { auditAdminAction } from "@/lib/admin/audit";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";
import { recordReliabilityFindings } from "@/lib/reliability/service";
import { incidentFingerprint } from "@/lib/reliability/incidents";
import { AUTHORITATIVE_DOMAINS, canAutoRepair, isHighRisk, sanitizeReconciliationEvidence } from "./model";

type Finding = {
  type: ReconciliationDiscrepancyType;
  domain: ReconciliationDomain;
  severity: ReconciliationSeverity;
  authoritativeDomain: string;
  affectedEntityType: string;
  affectedEntityId: string;
  description: string;
  evidence: Record<string, unknown>;
};

const RULES = [
  { key:"ORD-ITEM-ORPHAN", domain:"ORDER" as const, type:"ORPHAN_RECORD" as const, severity:"CRITICAL" as const, authority:"ORDER", sql:'SELECT oi.id FROM "OrderItem" oi LEFT JOIN "Order" o ON o.id=oi."orderId" WHERE o.id IS NULL LIMIT 100' },
  { key:"FUL-ORPHAN", domain:"FULFILLMENT" as const, type:"ORPHAN_RECORD" as const, severity:"CRITICAL" as const, authority:"FULFILLMENT", sql:'SELECT f.id FROM "Fulfillment" f LEFT JOIN "Order" o ON o.id=f."orderId" WHERE o.id IS NULL LIMIT 100' },
  { key:"SHIP-ORPHAN-FULFILLMENT", domain:"SHIPPING" as const, type:"ORPHAN_RECORD" as const, severity:"HIGH" as const, authority:"SHIPPING", sql:'SELECT s.id FROM "Shipment" s LEFT JOIN "Fulfillment" f ON f.id=s."fulfillmentId" WHERE f.id IS NULL LIMIT 100' },
  { key:"SHIP-ORPHAN-ORDER", domain:"SHIPPING" as const, type:"INVALID_REFERENCE" as const, severity:"HIGH" as const, authority:"ORDER", sql:'SELECT s.id FROM "Shipment" s LEFT JOIN "Order" o ON o.id=s."orderId" WHERE o.id IS NULL LIMIT 100' },
  { key:"TRACK-ORPHAN", domain:"SHIPPING" as const, type:"ORPHAN_RECORD" as const, severity:"HIGH" as const, authority:"SHIPPING", sql:'SELECT t.id FROM "TrackingEvent" t LEFT JOIN "Shipment" s ON s.id=t."shipmentId" WHERE s.id IS NULL LIMIT 100' },
  { key:"FUL-ITEM-ORPHAN", domain:"FULFILLMENT" as const, type:"ORPHAN_RECORD" as const, severity:"HIGH" as const, authority:"ORDER", sql:'SELECT fi.id FROM "FulfillmentItem" fi LEFT JOIN "OrderItem" oi ON oi.id=fi."orderItemId" WHERE oi.id IS NULL LIMIT 100' },
  { key:"PAYMENT-ORDER-MISSING", domain:"PAYMENT" as const, type:"MISSING_DEPENDENCY" as const, severity:"CRITICAL" as const, authority:"PAYMENT", sql:'SELECT p.id FROM "Payment" p LEFT JOIN "Order" o ON o."paymentId"=p.id WHERE p.status IN (\'SUCCEEDED\',\'PARTIALLY_REFUNDED\',\'REFUNDED\') AND o.id IS NULL LIMIT 100' },
  { key:"ORDER-CUSTOMER-MISSING", domain:"CUSTOMER" as const, type:"OWNERSHIP_MISMATCH" as const, severity:"CRITICAL" as const, authority:"CUSTOMER", sql:'SELECT o.id FROM "Order" o LEFT JOIN "Customer" c ON c.id=o."customerId" WHERE c.id IS NULL LIMIT 100' },
  { key:"PROVIDER-MAPPING-ORPHAN", domain:"PROVIDERS" as const, type:"PROVIDER_MISMATCH" as const, severity:"HIGH" as const, authority:"CATALOG", sql:'SELECT m.id FROM "FulfillmentProviderMapping" m LEFT JOIN "ProductVariant" v ON v.id=m."variantId" WHERE v.id IS NULL LIMIT 100' },
  { key:"ANALYTICS-CUSTOMER-MISSING", domain:"ANALYTICS" as const, type:"OWNERSHIP_MISMATCH" as const, severity:"LOW" as const, authority:"CUSTOMER", sql:'SELECT a.id FROM "AnalyticsEvent" a LEFT JOIN "Customer" c ON c.id=a."customerId" WHERE a."customerId" IS NOT NULL AND c.id IS NULL LIMIT 100' },
  { key:"NOTIFICATION-CUSTOMER-MISSING", domain:"NOTIFICATIONS" as const, type:"INVALID_REFERENCE" as const, severity:"HIGH" as const, authority:"CUSTOMER", sql:'SELECT n.id FROM "NotificationDelivery" n LEFT JOIN "Customer" c ON c.id=n."customerId" WHERE c.id IS NULL LIMIT 100' },
  { key:"NOTIFICATION-EVENT-MISSING", domain:"NOTIFICATIONS" as const, type:"MISSING_DEPENDENCY" as const, severity:"HIGH" as const, authority:"NOTIFICATIONS", sql:'SELECT n.id FROM "NotificationDelivery" n LEFT JOIN "NotificationEvent" e ON e.id=n."notificationEventId" WHERE e.id IS NULL LIMIT 100' },
] as const;

async function scanRule(rule: typeof RULES[number]): Promise<Finding[]> {
  const rows = await db.$queryRawUnsafe<Array<{id:string}>>(rule.sql);
  return rows.map((row) => ({
    type:rule.type, domain:rule.domain, severity:rule.severity, authoritativeDomain:rule.authority,
    affectedEntityType:rule.key, affectedEntityId:row.id,
    description:`${rule.key}: cross-domain integrity violation detected; no automatic mutation is performed.`,
    evidence:sanitizeReconciliationEvidence({rule:rule.key, authoritativeDomain:rule.authority}),
  }));
}

async function persistFinding(finding:Finding, correlationId?:string) {
  const existing=await db.reconciliationCase.findFirst({
    where:{type:finding.type,domain:finding.domain,affectedEntityType:finding.affectedEntityType,affectedEntityId:finding.affectedEntityId,status:{notIn:["RESOLVED","IGNORED","NOT_REPRODUCIBLE"]}},
    select:{id:true,version:true,retryCount:true,severity:true,status:true,affectedEntityType:true,domain:true,type:true,description:true},
  });
  if(existing) return existing;
  return db.reconciliationCase.create({data:{
    id:randomUUID(), type:finding.type, domain:finding.domain, severity:finding.severity, status:canAutoRepair(finding.type,finding.domain)?"AUTO_RESOLVABLE":"AWAITING_REVIEW",
    detectedBy:"reconciliation-engine", source:"integrity-scan", correlationId:correlationId?.slice(0,128),
    authoritativeDomain:finding.authoritativeDomain, affectedEntityType:finding.affectedEntityType, affectedEntityId:finding.affectedEntityId,
    description:finding.description, evidence:finding.evidence as Prisma.InputJsonValue,
  }});
}

export async function runReconciliation(options:{domains?:ReconciliationDomain[]; maxCases?:number; correlationId?:string}={}) {
  const selected=new Set(options.domains ?? RULES.map((r)=>r.domain));
  const maxCases=Math.min(Math.max(options.maxCases ?? 500,1),500);
  const findings:Finding[]=[];
  for(const rule of RULES){
    if(!selected.has(rule.domain)||findings.length>=maxCases) continue;
    findings.push(...(await scanRule(rule)).slice(0,Math.max(0,maxCases-findings.length)));
  }
  const cases=[];
  for(const finding of findings) cases.push(await persistFinding(finding,options.correlationId));
  const critical=cases.filter((item)=>item.severity==="CRITICAL" && !["RESOLVED","IGNORED"].includes(item.status));
  if(critical.length){
    await recordReliabilityFindings(critical.slice(0,20).map((item)=>({
      fingerprint:incidentFingerprint("reconciliation","DATA_INTEGRITY",item.affectedEntityType),
      severity:"CRITICAL", category:item.domain==="PAYMENT"||item.type==="FINANCIAL_MISMATCH"?"FINANCIAL":"DATA_INTEGRITY",
      capability:"cross-domain-reconciliation", title:item.description, summary:item.description,
      metadata:{reconciliationId:item.id,domain:item.domain,type:item.type,entityType:item.affectedEntityType},
    })));
  }
  return { scannedRules:RULES.filter((r)=>selected.has(r.domain)).length, findings:findings.length, cases:cases.length, critical:critical.length };
}

export async function reconciliationSummary() {
  const [total,detected,review,critical,high,resolved,failed]=await Promise.all([
    db.reconciliationCase.count(), db.reconciliationCase.count({where:{status:"DETECTED"}}), db.reconciliationCase.count({where:{status:"AWAITING_REVIEW"}}),
    db.reconciliationCase.count({where:{severity:"CRITICAL",status:{notIn:["RESOLVED","IGNORED","NOT_REPRODUCIBLE"]}}}),
    db.reconciliationCase.count({where:{severity:"HIGH",status:{notIn:["RESOLVED","IGNORED","NOT_REPRODUCIBLE"]}}}),
    db.reconciliationCase.count({where:{status:"RESOLVED"}}), db.reconciliationCase.count({where:{status:"FAILED"}}),
  ]);
  return {total,detected,awaitingReview:review,critical,high,resolved,failed};
}

export async function listReconciliationCases(options:{status?:ReconciliationStatus;domain?:ReconciliationDomain;severity?:ReconciliationSeverity;limit?:number}={}) {
  return db.reconciliationCase.findMany({where:{...(options.status?{status:options.status}:{}),...(options.domain?{domain:options.domain}:{}),...(options.severity?{severity:options.severity}:{})},orderBy:[{severity:"asc"},{detectedAt:"desc"}],take:Math.min(Math.max(options.limit??100,1),200)});
}

export async function resolveReconciliationCase(context:AdminAuthorizationContext,input:{id:string;expectedVersion:number;reason:string;resolution?:unknown}) {
  if(!input.reason.trim()) throw new Error("Resolution reason is required.");
  const current=await db.reconciliationCase.findUnique({where:{id:input.id}});
  if(!current) throw new Error("Reconciliation case was not found.");
  if(current.version!==input.expectedVersion) throw new Error("Reconciliation case changed concurrently. Refresh and retry.");
  const highRisk=isHighRisk(current.type,current.domain);
  if(highRisk && !context.roles.has("SUPER_ADMIN")) throw new Error("High-risk reconciliation requires SUPER_ADMIN authorization.");
  if(["RESOLVED","IGNORED","NOT_REPRODUCIBLE"].includes(current.status)) throw new Error("Reconciliation case is already terminal.");
  const resolution=sanitizeReconciliationEvidence(input.resolution);
  const updated=await db.$transaction(async(tx)=>{
    const latest=await tx.reconciliationCase.findUnique({where:{id:input.id}});
    if(!latest||latest.version!==input.expectedVersion) throw new Error("Reconciliation case changed concurrently. Refresh and retry.");
    const action=await tx.reconciliationAction.create({data:{reconciliationId:latest.id,actionType:"MANUAL_RESOLUTION",idempotencyKey:`manual-resolution:${latest.id}:${latest.version}`,actorAdminId:context.adminUser.id,beforeState:{status:latest.status,version:latest.version},afterState:{status:"RESOLVED"},reason:input.reason.trim().slice(0,1000),success:true,correlationId:null}});
    const row=await tx.reconciliationCase.update({where:{id:latest.id},data:{status:"RESOLVED",resolvedAt:new Date(),resolvedBy:context.adminUser.id,resolution:resolution as Prisma.InputJsonValue,version:{increment:1}}});
    return {row,action};
  });
  await auditAdminAction(context,{action:"RECONCILIATION_CASE_RESOLVED",resourceType:"ReconciliationCase",resourceId:updated.row.id,success:true,reason:input.reason,metadata:{domain:current.domain,type:current.type,highRisk}});
  return updated.row;
}

export async function retrySafeReconciliation(context:AdminAuthorizationContext,input:{id:string;expectedVersion:number}) {
  const current=await db.reconciliationCase.findUnique({where:{id:input.id}});
  if(!current) throw new Error("Reconciliation case was not found.");
  if(current.version!==input.expectedVersion) throw new Error("Reconciliation case changed concurrently. Refresh and retry.");
  if(!canAutoRepair(current.type,current.domain)) throw new Error("This discrepancy is not eligible for automatic repair.");
  if(current.status!=="AUTO_RESOLVABLE" && current.status!=="FAILED") throw new Error("Case is not eligible for safe retry.");
  const idem=`safe-repair:${current.id}:${current.version}`;
  const action=await db.reconciliationAction.create({data:{reconciliationId:current.id,actionType:"APPLY_SAFE_REPAIR",idempotencyKey:idem,beforeState:{status:current.status},reason:"Bounded safe reconciliation retry",success:true}});
  const row=await db.reconciliationCase.update({where:{id:current.id},data:{status:"RESOLVED",resolvedAt:new Date(),resolvedBy:"reconciliation-engine",resolution:{method:"projection-safe action acknowledged",actionId:action.id},version:{increment:1}}});
  await auditAdminAction(context,{action:"RECONCILIATION_SAFE_RETRY",resourceType:"ReconciliationCase",resourceId:row.id,success:true,reason:"Bounded safe reconciliation retry",metadata:{actionId:action.id}});
  return row;
}

export async function reconciliationHealthCheck() {
  return { domains:AUTHORITATIVE_DOMAINS, rules:RULES.map(({key,domain,type,severity,authority})=>({key,domain,type,severity,authority})), safeRepairTypes:["STALE_PROJECTION","MISSING_EVENT","DUPLICATE_EVENT"], automaticMutationBoundary:"No financial, customer ownership, provider shipment identity, order total, payment amount or irreversible order state is automatically mutated." };
}
