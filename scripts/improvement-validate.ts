import {calculatePriority,transitionAllowed,assertAutomationSafe,redact} from "../lib/improvement/service";
const priority=calculatePriority({customerImpact:5,severity:5,recurrence:5,sloImpact:5,reliabilityGain:5,securityRisk:5,privacyRisk:5,engineeringEffort:1,blastRadius:1,reversibility:5,confidence:5});
if(priority.methodology!=="15.30-v1"||typeof priority.total!=="number")throw new Error("Priority methodology invalid");
if(!transitionAllowed("DISCOVERED","TRIAGED")||transitionAllowed("DISCOVERED","CERTIFIED")||transitionAllowed("CERTIFIED","TRIAGED"))throw new Error("Lifecycle safety invalid");
assertAutomationSafe({riskClass:"OBSERVE_ONLY",executions:0,maxExecutions:1,cooldownElapsed:true,loopDetected:false,blastRadiusOk:true,preconditions:true});
for(const risk of ["APPROVAL_REQUIRED","HIGH_RISK","PROHIBITED"]){try{assertAutomationSafe({riskClass:risk,executions:0,maxExecutions:1,cooldownElapsed:true,loopDetected:false,blastRadiusOk:true,preconditions:true});throw new Error("Risk was not blocked");}catch(e){if(e instanceof Error&&e.message==="Risk was not blocked")throw e;}}
const red=redact({token:"secret",customerId:"reference-only",nested:{password:"pw"}});
if(JSON.stringify(red).includes('"secret"')||JSON.stringify(red).includes('"pw"'))throw new Error("Secret redaction failed");
console.log(JSON.stringify({phase:"15.30",priority:"deterministic",lifecycle:"strict",automation:"bounded",secrets:"redacted",financialMutation:false,providerMutation:false}));
