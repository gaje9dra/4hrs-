import { WORKFLOW_REGISTRY } from "../lib/synthetic/registry";
import { executeSyntheticWorkflow } from "../lib/synthetic/service";
const mode=(process.env.SYNTHETIC_EXECUTION_MODE??"CI") as "CI"|"PREVIEW_STAGING"|"PRODUCTION_SAFE";
const selected=process.env.SYNTHETIC_WORKFLOWS?.split(",").map(x=>x.trim()).filter(Boolean)??WORKFLOW_REGISTRY.filter(w=>w.productionSafe).map(w=>w.id);
const results=[];
for(const id of selected) results.push(await executeSyntheticWorkflow(id,mode));
console.log(JSON.stringify({mode,results},null,2));