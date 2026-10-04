import { listRegisteredActions } from "../lib/automation/actions.ts";
import { AUTOMATION_CIRCUIT_STATES, AUTOMATION_EXECUTION_STATES, AUTOMATION_RISK_CLASSES, validatePolicyDefinition } from "../lib/automation/model.ts";

const actions=listRegisteredActions();
if(actions.some(action=>action.risk==="PROHIBITED")) throw new Error("A prohibited action is registered.");
if(!AUTOMATION_RISK_CLASSES.includes("PROHIBITED")||!AUTOMATION_CIRCUIT_STATES.includes("OPEN")||!AUTOMATION_EXECUTION_STATES.includes("PENDING_APPROVAL")) throw new Error("Automation safety enums are incomplete.");
validatePolicyDefinition({risk:"SAFE_AUTOMATION",enabled:false,dryRun:true,timeoutSeconds:300,retryLimit:0,cooldownSeconds:300,maxExecutionsPerWindow:1,actions:["RERUN_SYNTHETIC_CHECK"]});
console.log(JSON.stringify({registeredActions:actions,defaultMutationPolicyDisabled:true,defaultDryRun:true,prohibitedActionRegistered:false}));
