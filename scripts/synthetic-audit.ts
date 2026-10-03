import { WORKFLOW_REGISTRY, validateWorkflowRegistry } from "../lib/synthetic/registry";
const errors=validateWorkflowRegistry();
const unsafe=WORKFLOW_REGISTRY.filter(w=>w.productionSafe&&!w.steps.every(s=>s.productionSafe));
if(unsafe.length) errors.push("production-safe workflows contain unsafe steps: "+unsafe.map(w=>w.id).join(","));
if(WORKFLOW_REGISTRY.length<30) errors.push("critical workflow registry is incomplete.");
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log(JSON.stringify({workflows:WORKFLOW_REGISTRY.length,productionSafe:WORKFLOW_REGISTRY.filter(w=>w.productionSafe).length,blocked:WORKFLOW_REGISTRY.filter(w=>!w.productionSafe).length}));