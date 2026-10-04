import { db } from "@/lib/db/client";

const faults=[
 ["DELAY","Controlled bounded latency","DEPENDENCY_FAILURE","LOW"],
 ["TIMEOUT","Controlled timeout","DEPENDENCY_FAILURE","MEDIUM"],
 ["TRANSIENT_ERROR","Controlled transient error","DEPENDENCY_FAILURE","MEDIUM"],
 ["PERMANENT_ERROR","Controlled permanent error","DEPENDENCY_FAILURE","HIGH"],
 ["CONNECTION_FAILURE","Controlled connection failure","NETWORK_FAILURE","MEDIUM"],
 ["RESOURCE_UNAVAILABLE","Controlled resource unavailable","DEPENDENCY_FAILURE","HIGH"],
 ["JOB_CRASH","Synthetic worker crash","JOB_FAILURE","MEDIUM"],
 ["JOB_DELAY","Synthetic worker delay","JOB_FAILURE","LOW"],
 ["QUEUE_BACKLOG","Bounded synthetic backlog","QUEUE_FAILURE","MEDIUM"],
 ["CACHE_MISS","Controlled cache miss","CACHE_FAILURE","LOW"],
 ["SEARCH_INDEX_FAILURE","Controlled search index failure","SEARCH_FAILURE","MEDIUM"],
 ["NOTIFICATION_FAILURE","Controlled notification failure","NOTIFICATION_FAILURE","LOW"],
 ["DEPENDENCY_DEGRADATION","Bounded dependency degradation","DEPENDENCY_FAILURE","MEDIUM"]
] as const;

async function main(){
 const target=await db.experimentTarget.upsert({
  where:{stableId:"synthetic-production:resilience"},
  create:{stableId:"synthetic-production:resilience",name:"4HRS+ isolated synthetic resilience workflow",targetType:"SYNTHETIC_WORKFLOW",environment:"production",syntheticOnly:true,productionSafe:true,allowlisted:true,scope:{workflow:"resilience-synthetic",customerImpact:0,financialMutation:false,providerMutation:false}},
  update:{allowlisted:true,productionSafe:true,syntheticOnly:true}
 });
 for(const [stableId,name,category,riskClass] of faults){
  await db.experimentFault.upsert({where:{stableId},create:{stableId,name,category,riskClass,supportedTargets:[target.stableId],maximumDurationSeconds:riskClass==="HIGH"?60:300,maximumAffectedRequests:0,maximumAffectedJobs:1,rollbackBehavior:{mode:"STOP_NOOP"},observabilityRequirements:{logs:true,metrics:true,audit:true},enabled:true},update:{enabled:true,supportedTargets:[target.stableId]}});
 }
 console.log(JSON.stringify({target:target.stableId,faults:faults.length}));
}
main().catch(error=>{console.error(error);process.exit(1);});
