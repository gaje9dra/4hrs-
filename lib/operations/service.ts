import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { checkDatabaseHealth } from "@/lib/observability/health";
import { listReliabilityIncidents } from "@/lib/reliability/operations";
import { reconciliationSummary } from "@/lib/reconciliation/service";
import { syntheticSummary } from "@/lib/synthetic/service";
import { costCapacitySummary } from "@/lib/cost-capacity/service";
import { governanceSummary } from "@/lib/governance/service";
import { createQikinkFulfillmentProvider } from "@/lib/fulfillment/providers/qikink";
import { SERVICE_INVENTORY,DEPENDENCY_GRAPH,RUNBOOKS,combineHealth,propagateDependencyHealth,type OperationalHealthState } from "./model";
function envName(){return process.env.NODE_ENV==="production"?"PRODUCTION":(process.env.NODE_ENV??"development").toUpperCase();}
export async function getServiceHealthSnapshot(){
 const now=new Date(); const database=await checkDatabaseHealth();
 const [synthetic,incidents,reconciliation,costCapacity,governance]=await Promise.all([syntheticSummary(),listReliabilityIncidents({limit:100}),reconciliationSummary(),costCapacitySummary(),governanceSummary()]);
 const qikink=createQikinkFulfillmentProvider(); const states=new Map<string,OperationalHealthState>();
 states.set("database",database.ok?"HEALTHY":"UNAVAILABLE"); states.set("application",database.ok?"HEALTHY":"DEGRADED"); states.set("api",database.ok?"HEALTHY":"DEGRADED"); states.set("storefront",database.ok?"HEALTHY":"DEGRADED");
 states.set("observability","HEALTHY"); states.set("deployment",process.env.NETLIFY_DEPLOY_ID||process.env.COMMIT_REF?"HEALTHY":"UNKNOWN"); states.set("qikink",qikink.capabilities.createFulfillment?"HEALTHY":"BLOCKED"); states.set("tracking",qikink.capabilities.statusLookup?"HEALTHY":"BLOCKED");
 states.set("payment-provider","UNKNOWN"); states.set("notifications","UNKNOWN"); states.set("analytics","UNKNOWN"); states.set("cache","UNKNOWN"); states.set("storage","UNKNOWN"); states.set("search",synthetic.failing>0?"FAILING":synthetic.total>0?"HEALTHY":"UNKNOWN"); states.set("queues","UNKNOWN"); states.set("fulfillment",synthetic.failing>0?"DEGRADED":"UNKNOWN"); states.set("shipping",qikink.capabilities.statusLookup?"UNKNOWN":"BLOCKED"); states.set("authentication","UNKNOWN");
 const openIncidents=incidents.filter(i=>i.status!=="RESOLVED");
 if(openIncidents.some(i=>i.severity==="CRITICAL")) for(const key of ["application","api","storefront"]) if(states.get(key)==="HEALTHY") states.set(key,"DEGRADED");
 if(reconciliation.critical>0) states.set("fulfillment","DEGRADED"); if(governance.critical>0||governance.failed>0) states.set("observability","DEGRADED"); if(costCapacity.openAnomalies>0&&states.get("deployment")==="HEALTHY") states.set("deployment","DEGRADED");
 const services=SERVICE_INVENTORY.map(service=>{
   const direct=states.get(service.id)??"UNKNOWN"; const dependencyStatus=DEPENDENCY_GRAPH.filter(edge=>edge.component===service.id).map(edge=>({...edge,health:states.get(edge.dependency)??"UNKNOWN"})); const health=combineHealth([direct,propagateDependencyHealth(service.id,dependencyStatus)]);
   return {...service,operationalStatus:health,lastSuccessfulCheck:health==="HEALTHY"?now.toISOString():null,lastFailedCheck:["FAILING","UNAVAILABLE"].includes(health)?now.toISOString():null,failureReason:health==="UNKNOWN"?"No authoritative runtime signal is available.":health==="BLOCKED"?"Capability is explicitly unavailable or contract-blocked.":null,dependencyStatus,timestamp:now.toISOString(),version:process.env.APP_VERSION??process.env.COMMIT_REF??"unknown",environment:envName()};
 });
 return {timestamp:now.toISOString(),environment:envName(),services,dependencyGraph:DEPENDENCY_GRAPH.map(edge=>({...edge,health:states.get(edge.dependency)??"UNKNOWN"})),criticalIncidents:openIncidents.filter(i=>i.severity==="CRITICAL"),summaries:{synthetic,reconciliation,costCapacity,governance}};
}
export async function getOperationsDashboard(){
 const health=await getServiceHealthSnapshot();
 const migration=await db.$queryRaw<Array<{migration_name:string;finished_at:Date|null;rolled_back_at:Date|null}>>(Prisma.sql`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 100`);
 const failedMigrations=migration.filter(row=>!row.finished_at||row.rolled_back_at!==null);
 const recentOperatorActions=await db.adminAuditLog.findMany({orderBy:{createdAt:"desc"},take:25,select:{id:true,action:true,resourceType:true,resourceId:true,success:true,reason:true,correlationId:true,createdAt:true}});
 return {...health,deployment:{currentRelease:process.env.APP_VERSION??process.env.COMMIT_REF??null,deploymentId:process.env.NETLIFY_DEPLOY_ID??null,rollbackAvailable:Boolean(process.env.NETLIFY_DEPLOY_ID),migrationStatus:failedMigrations.length?"FAILING":"HEALTHY"},backgroundJobs:{status:"UNKNOWN" as OperationalHealthState,reason:"No centralized execution telemetry exists for every scheduled/background job."},runbooks:RUNBOOKS.map(([id,title,trigger,safety])=>({id,title,trigger,safety})),recentOperatorActions,migrationEvidence:{checked:migration.length,failed:failedMigrations.length}};
}
export async function runOperationalHealthCheck(){
 const snapshot=await getServiceHealthSnapshot(); return {status:snapshot.services.some(s=>s.operationalStatus==="UNAVAILABLE"||s.operationalStatus==="FAILING")?"FAILING":snapshot.services.some(s=>s.operationalStatus==="UNKNOWN")?"UNKNOWN":"HEALTHY",timestamp:snapshot.timestamp,criticalUnknowns:snapshot.services.filter(s=>s.criticality==="CRITICAL"&&s.operationalStatus==="UNKNOWN").map(s=>s.id),criticalFailures:snapshot.services.filter(s=>s.criticality==="CRITICAL"&&["FAILING","UNAVAILABLE"].includes(s.operationalStatus)).map(s=>s.id)};
}