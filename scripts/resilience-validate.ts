import { EXPERIMENT_CATEGORIES, EXPERIMENT_MODES, EXPERIMENT_STATES, FAULT_KEYS } from "@/lib/resilience/experiments";

const requiredStates=["DRAFT","REVIEW","APPROVED","SCHEDULED","READY","RUNNING","PAUSING","STOPPING","COMPLETED","FAILED","ABORTED","BLOCKED","EXPIRED","RETIRED"];
const requiredModes=["SIMULATION","STAGING","SYNTHETIC_PRODUCTION","CONTROLLED_PRODUCTION","PROHIBITED"];
const requiredFaults=["DELAY","TIMEOUT","TRANSIENT_ERROR","PERMANENT_ERROR","CONNECTION_FAILURE","RESOURCE_UNAVAILABLE","JOB_CRASH","JOB_DELAY","QUEUE_BACKLOG","CACHE_MISS","SEARCH_INDEX_FAILURE","NOTIFICATION_FAILURE","DEPENDENCY_DEGRADATION"];
for(const x of requiredStates)if(!EXPERIMENT_STATES.includes(x as never))throw new Error("Missing experiment state: "+x);
for(const x of requiredModes)if(!EXPERIMENT_MODES.includes(x as never))throw new Error("Missing experiment mode: "+x);
for(const x of requiredFaults)if(!FAULT_KEYS.includes(x as never))throw new Error("Missing fault catalog entry: "+x);
if(EXPERIMENT_MODES.includes("PROHIBITED")===false)throw new Error("Prohibited mode must remain explicit.");
if(EXPERIMENT_CATEGORIES.length<9)throw new Error("Resilience category coverage is incomplete.");
console.log(JSON.stringify({states:EXPERIMENT_STATES.length,modes:EXPERIMENT_MODES.length,faults:FAULT_KEYS.length,categories:EXPERIMENT_CATEGORIES.length}));
