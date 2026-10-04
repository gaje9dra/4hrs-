import {SIMULATION_CERTIFICATION_FRESHNESS,SIMULATION_EXECUTION_MODES,SIMULATION_LIFECYCLE,SIMULATION_RISKS,SIMULATION_RESULTS,SIMULATION_TYPES,MAX_CONCURRENCY,MAX_DURATION_SECONDS,MAX_GRAPH_DEPTH,MAX_RECORDS,MAX_RESOURCE_UNITS,MAX_RETRIES,MAX_STEPS,closed,normalizeLimits} from "@/lib/simulation/model";
const uniq=(a:readonly string[])=>new Set(a).size===a.length;
for(const x of [SIMULATION_EXECUTION_MODES,SIMULATION_LIFECYCLE,SIMULATION_RISKS,SIMULATION_RESULTS,SIMULATION_CERTIFICATION_FRESHNESS,SIMULATION_TYPES])if(!uniq(x))throw new Error("Simulation vocabulary contains duplicates");
if(!closed(SIMULATION_EXECUTION_MODES,"SIMULATION")||closed(SIMULATION_EXECUTION_MODES,"PRODUCTION"))throw new Error("Execution mode guard failed");
const l=normalizeLimits({durationSeconds:99999,steps:99999,graphDepth:99,records:99999,retries:99,concurrency:99,resourceUnits:99999});
if(l.durationSeconds!==MAX_DURATION_SECONDS||l.steps!==MAX_STEPS||l.graphDepth!==MAX_GRAPH_DEPTH||l.records!==MAX_RECORDS||l.retries!==MAX_RETRIES||l.concurrency!==MAX_CONCURRENCY||l.resourceUnits!==MAX_RESOURCE_UNITS)throw new Error("Simulation limits are not bounded");
console.log(JSON.stringify({phase:"15.33",executionModes:SIMULATION_EXECUTION_MODES.length,scenarioTypes:SIMULATION_TYPES.length,lifecycleStates:SIMULATION_LIFECYCLE.length,boundedLimits:l}));
