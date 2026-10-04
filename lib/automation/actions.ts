import { executeSyntheticWorkflow } from "@/lib/synthetic/service";
export type AutomationActionContext={reason:string;correlationId:string;environment:string;targetResource:string};
export type RegisteredAutomationAction={key:string;label:string;risk:"OBSERVE_ONLY"|"SAFE_AUTOMATION"|"CONTROLLED_AUTOMATION"|"APPROVAL_REQUIRED"|"HIGH_RISK"|"PROHIBITED";rollback:"REVERSIBLE"|"CONDITIONALLY_REVERSIBLE"|"IRREVERSIBLE";execute:(context:AutomationActionContext,parameters:Record<string,unknown>)=>Promise<unknown>};

const ACTIONS:Record<string,RegisteredAutomationAction>={
  RECORD_DIAGNOSTIC:{key:"RECORD_DIAGNOSTIC",label:"Record diagnostic evidence",risk:"OBSERVE_ONLY",rollback:"IRREVERSIBLE",execute:async(context)=>({recorded:true,target:context.targetResource})},
  RERUN_SYNTHETIC_CHECK:{key:"RERUN_SYNTHETIC_CHECK",label:"Rerun a registered synthetic workflow",risk:"SAFE_AUTOMATION",rollback:"IRREVERSIBLE",execute:async(context,parameters)=>{
    const workflowId=parameters.workflowId;
    if(typeof workflowId!=="string"||!workflowId.trim())throw new Error("A registered workflowId is required.");
    return executeSyntheticWorkflow(workflowId.trim(),"MANUAL_DIAGNOSTIC",{reason:context.reason,correlationId:context.correlationId});
  }},
};

export function getRegisteredAction(key:string){return ACTIONS[key];}
export function listRegisteredActions(){return Object.values(ACTIONS).map(({key,label,risk,rollback})=>({key,label,risk,rollback}));}
export async function executeRegisteredAction(key:string,context:AutomationActionContext,parameters:Record<string,unknown>){const action=getRegisteredAction(key);if(!action)throw new Error("Automation action is not registered.");if(action.risk==="PROHIBITED")throw new Error("The requested automation action is prohibited.");return action.execute(context,parameters);}
