import { SERVICE_INVENTORY,DEPENDENCY_GRAPH,RUNBOOKS,OPERATIONAL_HEALTH_STATES } from "../lib/operations/model";
const ids=new Set(SERVICE_INVENTORY.map(s=>s.id));
if(SERVICE_INVENTORY.length<15)throw new Error("Operational service inventory is incomplete.");
if(DEPENDENCY_GRAPH.some(e=>!ids.has(e.component)||!ids.has(e.dependency)))throw new Error("Dependency graph references an unknown component.");
if(RUNBOOKS.length<15)throw new Error("Critical runbook registry is incomplete.");
if(OPERATIONAL_HEALTH_STATES.length!==7)throw new Error("Operational health state model is incomplete.");
if(SERVICE_INVENTORY.some(s=>s.operationalStatus!=="UNKNOWN"))throw new Error("Service inventory must not fabricate initial health.");
console.log(JSON.stringify({status:"ok",services:SERVICE_INVENTORY.length,dependencies:DEPENDENCY_GRAPH.length,runbooks:RUNBOOKS.length,healthStates:OPERATIONAL_HEALTH_STATES}));