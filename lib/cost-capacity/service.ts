import { randomUUID } from "node:crypto";
import { type CostMeasurementStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { auditAdminAction } from "@/lib/admin/audit";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";
import { detectAnomaly, evaluateCapacity, sanitizeMetricMetadata, classifyCostStatus } from "./model";

export const RESOURCE_INVENTORY = [
  { key:"postgresql", name:"PostgreSQL", category:"DATABASE" as const, purpose:"Canonical commerce, customer, governance and operational persistence", owner:"platform", environment:"PRODUCTION" as const, criticality:"CRITICAL", provider:null },
  { key:"netlify", name:"Application hosting", category:"INFRASTRUCTURE" as const, purpose:"Production application hosting and deployment runtime", owner:"platform", environment:"PRODUCTION" as const, criticality:"CRITICAL", provider:"Netlify" },
  { key:"github-actions", name:"CI/CD", category:"BUILD_AND_DEPLOYMENT" as const, purpose:"Build, test, migration and release validation workloads", owner:"release-engineering", environment:"PRODUCTION" as const, criticality:"HIGH", provider:"GitHub Actions" },
  { key:"qikink", name:"Qikink fulfillment integration", category:"FULFILLMENT" as const, purpose:"Provider fulfillment handoff only; never catalog ownership", owner:"fulfillment-operations", environment:"PRODUCTION" as const, criticality:"HIGH", provider:"Qikink" },
  { key:"payment-provider", name:"Payment provider", category:"PAYMENT_PROCESSING" as const, purpose:"External payment processing; commerce financial truth remains canonical internally", owner:"payments-operations", environment:"PRODUCTION" as const, criticality:"CRITICAL", provider:"PayU" },
  { key:"analytics", name:"Analytics subsystem", category:"ANALYTICS" as const, purpose:"Operational and product analytics events", owner:"analytics", environment:"PRODUCTION" as const, criticality:"MEDIUM", provider:null },
  { key:"search", name:"Search/discovery subsystem", category:"SEARCH" as const, purpose:"Provider-neutral product discovery workload", owner:"search-operations", environment:"PRODUCTION" as const, criticality:"HIGH", provider:null },
  { key:"notifications", name:"Notification subsystem", category:"THIRD_PARTY_API" as const, purpose:"Transactional communication workload", owner:"communications-operations", environment:"PRODUCTION" as const, criticality:"HIGH", provider:null },
] as const;

function safeStatus(status: string | undefined): CostMeasurementStatus | undefined {
  return status && ["ACTUAL","ESTIMATED","ALLOCATED","PROJECTED","UNKNOWN"].includes(status) ? status as CostMeasurementStatus : undefined;
}

export async function ensureResourceInventory() {
  for (const item of RESOURCE_INVENTORY) {
    await db.costResource.upsert({
      where:{ key:item.key },
      update:{ name:item.name, category:item.category, purpose:item.purpose, owner:item.owner, environment:item.environment, criticality:item.criticality, provider:item.provider, active:true },
      create:{ id:randomUUID(), ...item },
    });
  }
  return db.costResource.findMany({ where:{ active:true }, orderBy:{ key:"asc" } });
}

export async function recordResourceMetric(input:{
  resourceKey:string; metricKey:string; value:number; unit:string; status?:CostMeasurementStatus;
  service?:string; correlationId?:string; metadata?:unknown;
}) {
  if (!Number.isFinite(input.value)) throw new Error("Metric value must be finite.");
  if (!input.metricKey.trim() || input.metricKey.length > 120) throw new Error("Metric key is invalid.");
  if (!input.unit.trim() || input.unit.length > 32) throw new Error("Metric unit is invalid.");
  const resource=await db.costResource.findUnique({where:{key:input.resourceKey}});
  if (!resource) throw new Error("Cost resource was not found.");
  const status=input.status ?? classifyCostStatus({providerBillingAvailable:resource.billingAvailable, measured:true});
  return db.costResourceMetric.create({data:{
    resourceId:resource.id, metricKey:input.metricKey.trim(), value:input.value, unit:input.unit.trim(),
    status, service:input.service?.trim().slice(0,120), correlationId:input.correlationId?.trim().slice(0,128),
    metadata:sanitizeMetricMetadata(input.metadata),
  }});
}

export async function evaluateCapacityPolicies() {
  const limits=await db.capacityLimit.findMany({where:{enabled:true},include:{resource:true}});
  const results=[];
  for (const limit of limits) {
    const latest=await db.costResourceMetric.findFirst({where:{resourceId:limit.resourceId,metricKey:limit.metricKey},orderBy:{measuredAt:"desc"}});
    if (!latest) continue;
    const evaluation=evaluateCapacity(Number(latest.value),Number(limit.threshold),limit.severity,limit.action,limit.escalationPath);
    results.push({resource:limit.resource.key,metricKey:limit.metricKey,latestValue:Number(latest.value),threshold:Number(limit.threshold),kind:limit.kind,...evaluation});
  }
  return results;
}

export async function detectCostAnomalies(options:{lookbackHours?:number; minimumAbsoluteDeviation?:number}={}) {
  const lookbackHours=Math.min(Math.max(options.lookbackHours ?? 168,24),720);
  const since=new Date(Date.now()-lookbackHours*3600000);
  const resources=await db.costResource.findMany({where:{active:true}});
  const created=[];
  for (const resource of resources) {
    const metrics=await db.costResourceMetric.findMany({where:{resourceId:resource.id,measuredAt:{gte:since}},orderBy:{measuredAt:"asc"},take:2000});
    const byKey=new Map<string,number[]>();
    for(const metric of metrics){const values=byKey.get(metric.metricKey) ?? []; values.push(Number(metric.value)); byKey.set(metric.metricKey,values);}
    for(const [metricKey,values] of byKey){
      if(values.length<3) continue;
      const latest=values[values.length-1];
      const baseline=values.slice(0,-1).reduce((a,b)=>a+b,0)/(values.length-1);
      const result=detectAnomaly(latest,baseline,options.minimumAbsoluteDeviation ?? 0);
      if(!result.anomalous) continue;
      const anomaly=await db.costAnomaly.create({data:{id:randomUUID(),resourceId:resource.id,metricKey,status:"OPEN",severity:"MEDIUM",observedValue:latest,baselineValue:baseline,deviation:result.deviation,evidence:{sampleCount:values.length,lookbackHours}}});
      created.push(anomaly);
    }
  }
  return created;
}

export async function costCapacitySummary() {
  const [resources,metricCount,openAnomalies,hardLimits,softLimits,recent] = await Promise.all([
    db.costResource.count({where:{active:true}}),
    db.costResourceMetric.count({where:{measuredAt:{gte:new Date(Date.now()-86400000)}}}),
    db.costAnomaly.count({where:{status:"OPEN"}}),
    db.capacityLimit.count({where:{kind:"HARD",enabled:true}}),
    db.capacityLimit.count({where:{kind:"SOFT",enabled:true}}),
    db.costResourceMetric.findMany({where:{measuredAt:{gte:new Date(Date.now()-86400000)}},orderBy:{measuredAt:"desc"},take:100,select:{resourceId:true,metricKey:true,value:true,unit:true,status:true,measuredAt:true,service:true}}),
  ]);
  return { resources, metricCount24h:metricCount, openAnomalies, hardLimits, softLimits, recentMetrics:recent };
}

export async function adminRecordMetric(context:AdminAuthorizationContext,input:Parameters<typeof recordResourceMetric>[0]){
  const metric=await recordResourceMetric(input);
  await auditAdminAction(context,{action:"COST_RESOURCE_METRIC_RECORDED",resourceType:"CostResourceMetric",resourceId:metric.id,success:true,reason:"Operational resource metric recorded",metadata:{resourceKey:input.resourceKey,metricKey:input.metricKey,status:metric.status}});
  return metric;
}

export async function adminEvaluate(context:AdminAuthorizationContext){
  const capacity=await evaluateCapacityPolicies();
  const anomalies=await detectCostAnomalies();
  await auditAdminAction(context,{action:"COST_CAPACITY_EVALUATED",resourceType:"CostCapacityControlPlane",success:true,reason:"Capacity and anomaly controls evaluated",metadata:{capacityEvaluations:capacity.length,anomaliesCreated:anomalies.length}});
  return {capacity,anomalies};
}
