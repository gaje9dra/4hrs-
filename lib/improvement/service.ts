import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";

export const LIFECYCLE={DISCOVERED:"TRIAGED",TRIAGED:"ANALYZING",ANALYZING:"PROPOSED",PROPOSED:"REVIEW_REQUIRED",REVIEW_REQUIRED:"APPROVED",APPROVED:"IMPLEMENTING",IMPLEMENTING:"VALIDATING",VALIDATING:"VERIFIED",VERIFIED:"CERTIFIED"} as const;
export const TERMINAL=new Set(["REJECTED","DEFERRED","ROLLED_BACK","ABANDONED","CERTIFIED"]);
export const VALIDATION=["NOT_STARTED","RUNNING","PASSED","PASSED_WITH_LIMITATIONS","FAILED","BLOCKED","ROLLED_BACK"] as const;
export const RISK=["OBSERVE_ONLY","SAFE_AUTOMATION","CONTROLLED_AUTOMATION","APPROVAL_REQUIRED","HIGH_RISK","PROHIBITED"] as const;
export const OUTCOMES=["SUCCESS","PARTIAL_SUCCESS","NO_MEASURABLE_EFFECT","REGRESSION","FAILED","ROLLED_BACK"] as const;
type R=Record<string,unknown>;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function redact(v:unknown):unknown{
 const walk=(x:unknown,d=0):unknown=>{if(d>6)return "[TRUNCATED]";if(x===null||typeof x==="string"||typeof x==="number"||typeof x==="boolean")return x;if(Array.isArray(x))return x.slice(0,100).map(y=>walk(y,d+1));if(typeof x==="object"){const o:R={};for(const[k,y]of Object.entries(x)){if(/password|secret|token|authorization|cookie|apiKey|privateKey|cardNumber|cvv/i.test(k))o[k]="[REDACTED]";else o[k]=walk(y,d+1)}return o}return String(x)};return walk(v);
}
export function transitionAllowed(from:string,to:string){
 if(TERMINAL.has(from)) return false;
 if(to==="REJECTED"||to==="DEFERRED"||to==="ABANDONED") return true;
 return LIFECYCLE[from as keyof typeof LIFECYCLE]===to;
}
export function calculatePriority(f:R){
 const weights={customerImpact:5,severity:4,recurrence:4,sloImpact:4,reliabilityGain:4,securityRisk:5,privacyRisk:5,engineeringEffort:-2,blastRadius:-4,reversibility:2,confidence:3};
 const values:Record<string,number>={customerImpact:Number(f.customerImpact??0),severity:Number(f.severity??0),recurrence:Number(f.recurrence??0),sloImpact:Number(f.sloImpact??0),reliabilityGain:Number(f.reliabilityGain??0),securityRisk:Number(f.securityRisk??0),privacyRisk:Number(f.privacyRisk??0),engineeringEffort:Number(f.engineeringEffort??0),blastRadius:Number(f.blastRadius??0),reversibility:Number(f.reversibility??0),confidence:Number(f.confidence??0)};
 const factors=Object.fromEntries(Object.entries(weights).map(([k,w])=>[k,{weight:w,value:values[k]??0,contribution:(values[k]??0)*w}]));
 return {methodology:"15.30-v1",factors,total:Object.values(factors).reduce((n,v)=>n+Number((v as R).contribution),0)};
}
export function validateRisk(risk:string){if(!RISK.includes(risk as never))throw new Error("Unknown improvement risk class.");if(risk==="PROHIBITED")throw new Error("Prohibited improvements cannot be automated.");}
export function classifyOutcome(input:{expectedBenefit:number;actualBenefit:number;regression:number;rolledBack?:boolean}){
 if(input.rolledBack)return "ROLLED_BACK";if(input.regression>0.2)return "REGRESSION";if(input.actualBenefit>=input.expectedBenefit&&input.expectedBenefit>0)return "SUCCESS";if(input.actualBenefit>0)return "PARTIAL_SUCCESS";return "NO_MEASURABLE_EFFECT";
}
export function assertAutomationSafe(input:{riskClass:string;executions:number;maxExecutions:number;cooldownElapsed:boolean;loopDetected:boolean;blastRadiusOk:boolean;preconditions:boolean}){
 validateRisk(input.riskClass);
 if(input.riskClass==="APPROVAL_REQUIRED"||input.riskClass==="HIGH_RISK")throw new Error("Human/elevated approval is required before automation.");
 if(input.executions>=input.maxExecutions||!input.cooldownElapsed||input.loopDetected||!input.blastRadiusOk||!input.preconditions)throw new Error("Automation guardrail blocked execution.");
 return true;
}
export async function createOpportunity(input:{stableId:string;title:string;problem:string;sourceType:string;sourceId:string;domain:string;severity:string;confidence:string;riskClass:string;customerImpact:string;owner:string;evidence:unknown;hypothesis:unknown;factors:R}){
 validateRisk(input.riskClass);
 const existing=await db.improvementOpportunity.findUnique({where:{stableId:input.stableId}});if(existing)return existing;
 return db.improvementOpportunity.create({data:{stableId:input.stableId,title:input.title,problem:input.problem,sourceType:input.sourceType,sourceId:input.sourceId,domain:input.domain,severity:input.severity,confidence:input.confidence as never,riskClass:input.riskClass as never,customerImpact:input.customerImpact as never,owner:input.owner,evidence:redact(input.evidence) as never,hypothesis:redact(input.hypothesis) as never,priority:calculatePriority(input.factors) as never}});
}
export async function addEvidence(input:{opportunityId:string;sourceType:string;sourceId:string;environment:string;domain:string;severity:string;observedBehavior:string;expectedBehavior:string;impact:unknown;metrics:unknown;references:unknown}){
 const payload=redact(input);return db.improvementEvidence.create({data:{opportunityId:input.opportunityId,sourceType:input.sourceType,sourceId:input.sourceId,observedAt:new Date(),environment:input.environment,domain:input.domain,severity:input.severity,observedBehavior:input.observedBehavior,expectedBehavior:input.expectedBehavior,impact:redact(input.impact) as never,metrics:redact(input.metrics) as never,references:redact(input.references) as never,redactionVersion:"15.30-v1",integrityHash:hash(payload)}});
}
export async function propose(input:{opportunityId:string;owner:string;problem:string;hypothesis:string;proposedChange:unknown;affectedComponents:unknown;affectedDomains:unknown;riskClass:string;expectedBenefit:unknown;expectedFailureModes:unknown;rollbackStrategy:unknown;validationPlan:unknown;monitoringPlan:unknown;acceptanceCriteria:unknown;customerImpact:unknown;dependencyAssessment:unknown;databaseAssessment:unknown;governanceRefs:unknown;featureFlagRefs:unknown;digitalTwinRefs:unknown;resilienceRefs:unknown;releaseRefs:unknown;costAssessment:unknown;reviewers:unknown}){
 validateRisk(input.riskClass);const opportunity=await db.improvementOpportunity.findUnique({where:{id:input.opportunityId}});if(!opportunity)throw new Error("Opportunity not found.");
 const latest=await db.improvementProposal.findFirst({where:{opportunityId:input.opportunityId},orderBy:{version:"desc"}});const version=(latest?.version??0)+1;
 return db.improvementProposal.create({data:{opportunityId:input.opportunityId,version,problem:input.problem,hypothesis:input.hypothesis,proposedChange:redact(input.proposedChange) as never,affectedComponents:redact(input.affectedComponents) as never,affectedDomains:redact(input.affectedDomains) as never,riskClass:input.riskClass as never,expectedBenefit:redact(input.expectedBenefit) as never,expectedFailureModes:redact(input.expectedFailureModes) as never,rollbackStrategy:redact(input.rollbackStrategy) as never,validationPlan:redact(input.validationPlan) as never,monitoringPlan:redact(input.monitoringPlan) as never,acceptanceCriteria:redact(input.acceptanceCriteria) as never,customerImpact:redact(input.customerImpact) as never,owner:input.owner,reviewers:redact(input.reviewers) as never,dependencyAssessment:redact(input.dependencyAssessment) as never,databaseAssessment:redact(input.databaseAssessment) as never,governanceRefs:redact(input.governanceRefs) as never,featureFlagRefs:redact(input.featureFlagRefs) as never,digitalTwinRefs:redact(input.digitalTwinRefs) as never,resilienceRefs:redact(input.resilienceRefs) as never,releaseRefs:redact(input.releaseRefs) as never,costAssessment:redact(input.costAssessment) as never,certificationState:"UNKNOWN"}});
}
export async function moveOpportunity(id:string,from:string,to:string,actor:string,reason:string){
 if(!transitionAllowed(from,to))throw new Error(`Invalid lifecycle transition: ${from} -> ${to}`);
 const result=await db.improvementOpportunity.updateMany({where:{id,lifecycle:from as never},data:{lifecycle:to as never}});
 if(result.count!==1)throw new Error("Stale lifecycle update rejected.");
 await db.improvementTransition.create({data:{opportunityId:id,fromState:from,toState:to,actor,reason,metadata:{transitionVersion:"15.30-v1"}}});
 return db.improvementOpportunity.findUnique({where:{id}});
}
export async function approve(input:{proposalId:string;approver:string;role:string;decision:string;rationale:string;policyVersion:string;evidenceVersion:string;separationRequired:boolean;owner:string}){
 if(input.decision!=="APPROVE"&&input.decision!=="REJECT")throw new Error("Invalid approval decision.");
 if(input.separationRequired&&input.approver===input.owner)throw new Error("Self-approval is prohibited.");
 const p=await db.improvementProposal.findUnique({where:{id:input.proposalId}});if(!p)throw new Error("Proposal not found.");
 return db.improvementApproval.create({data:{proposalId:p.id,proposalVersion:p.version,approver:input.approver,role:input.role,decision:input.decision,rationale:input.rationale,policyVersion:input.policyVersion,evidenceVersion:input.evidenceVersion}});
}
export async function validateProposal(input:{proposalId:string;tests:unknown;evidence:unknown;blockers:string[];rollbackVerified:boolean;observabilityAvailable:boolean;customerImpact:unknown;governanceSatisfied:boolean;digitalTwinVerified:boolean;resilienceVerified:boolean}){
 const state=input.blockers.length?"BLOCKED":input.rollbackVerified&&input.observabilityAvailable&&input.governanceSatisfied&&input.digitalTwinVerified&&input.resilienceVerified?"PASSED":"PASSED_WITH_LIMITATIONS";
 const latest=await db.improvementValidation.findFirst({where:{proposalId:input.proposalId},orderBy:{validationVersion:"desc"}});const version=(latest?.validationVersion??0)+1;
 return db.improvementValidation.create({data:{proposalId:input.proposalId,validationVersion:version,state:state as never,requiredTests:redact(input.tests) as never,evidence:redact(input.evidence) as never,blockers:redact(input.blockers) as never,rollbackVerified:input.rollbackVerified,observabilityAvailable:input.observabilityAvailable,customerImpact:redact(input.customerImpact) as never,governanceSatisfied:input.governanceSatisfied,digitalTwinVerified:input.digitalTwinVerified,resilienceVerified:input.resilienceVerified,startedAt:new Date(),completedAt:new Date()}});
}
export async function recordOutcome(input:{proposalId:string;expectedBenefit:unknown;actualBenefit:unknown;regression:unknown;operationalImpact:unknown;customerImpact:unknown;costImpact:unknown;reliabilityImpact:unknown;sloImpact:unknown;errorBudgetImpact:unknown;numeric:{expectedBenefit:number;actualBenefit:number;regression:number};rolledBack?:boolean}){
 const outcome=classifyOutcome({expectedBenefit:input.numeric.expectedBenefit,actualBenefit:input.numeric.actualBenefit,regression:input.numeric.regression,rolledBack:input.rolledBack});
 return db.improvementOutcomeRecord.create({data:{proposalId:input.proposalId,outcome:outcome as never,expectedBenefit:redact(input.expectedBenefit) as never,actualBenefit:redact(input.actualBenefit) as never,regression:redact(input.regression) as never,operationalImpact:redact(input.operationalImpact) as never,customerImpact:redact(input.customerImpact) as never,costImpact:redact(input.costImpact) as never,reliabilityImpact:redact(input.reliabilityImpact) as never,sloImpact:redact(input.sloImpact) as never,errorBudgetImpact:redact(input.errorBudgetImpact) as never,evidence:{methodology:"15.30-v1"}}});
}
export async function certify(input:{proposalId:string;owner:string;ciStatus:string;testsPassed:boolean;securityStatus:string;dataIntegrityStatus:string;operationalStatus:string;governanceStatus:string;documentationStatus:string;rollbackReadiness:unknown;knownLimitations:unknown;unresolvedRisks:unknown;digitalTwinVerified:boolean;resilienceVerified:boolean;continuousLifecycleOperational:boolean}){
 const blockers=[!input.testsPassed?"tests":"",input.ciStatus!=="GREEN"?"ci":"",input.securityStatus==="CRITICAL"?"security":"",input.dataIntegrityStatus==="CRITICAL"?"data-integrity":"",input.governanceStatus==="CRITICAL"?"governance":"",!input.digitalTwinVerified?"digital-twin":"",!input.resilienceVerified?"resilience":"",!input.continuousLifecycleOperational?"lifecycle":""].filter(Boolean);
 const status=blockers.length?"NOT_READY":"READY_WITH_DOCUMENTED_LIMITATIONS";
 return db.improvementCertification.create({data:{proposalId:input.proposalId,status,implementationStatus:"COMPLETE",testStatus:input.testsPassed?"PASS":"FAIL",ciStatus:input.ciStatus,securityStatus:input.securityStatus,dataIntegrityStatus:input.dataIntegrityStatus,operationalStatus:input.operationalStatus,governanceStatus:input.governanceStatus,documentationStatus:input.documentationStatus,knownLimitations:redact(input.knownLimitations) as never,unresolvedRisks:redact({value:input.unresolvedRisks,blockers}) as never,rollbackReadiness:redact(input.rollbackReadiness) as never,owner:input.owner}});
}
export async function overview(){const [opportunities,proposals,validations,outcomes,certifications]=await Promise.all([db.improvementOpportunity.findMany({orderBy:{updatedAt:"desc"},take:100}),db.improvementProposal.findMany({orderBy:{updatedAt:"desc"},take:100}),db.improvementValidation.findMany({orderBy:{createdAt:"desc"},take:100}),db.improvementOutcomeRecord.findMany({orderBy:{measuredAt:"desc"},take:100}),db.improvementCertification.findMany({orderBy:{certifiedAt:"desc"},take:50})]);return {opportunities,proposals,validations,outcomes,certifications};}
