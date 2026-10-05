import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import {
  GOVERNANCE_ALGORITHM_VERSION,
  RISK_CLASSES,
  CONFIDENCE_LEVELS,
  createProposal,
  transitionProposal,
} from "@/lib/delivery-governance-intelligence/service";

export const GOVERNANCE_ADAPTATION_ALGORITHM_VERSION = "15.42-governance-adaptation-deterministic-v1";
export const ADAPTATION_STATES = [
  "DRAFT","SAFETY_ASSESSMENT","SIMULATION_REQUIRED","VALIDATION_REQUIRED",
  "GOVERNANCE_REVIEW","APPROVAL_REQUIRED","APPROVED","STAGED","CONTROLLED_VALIDATION",
  "VERIFIED","CERTIFIED","REJECTED","DEFERRED","BLOCKED","FAILED","EXPIRED",
  "SUPERSEDED","ROLLED_BACK","INVALIDATED"
] as const;
export type AdaptationState = typeof ADAPTATION_STATES[number];
export const ADAPTATION_DECISIONS = [
  "NO_CHANGE","COLLECT_MORE_EVIDENCE","REQUIRE_SIMULATION","REQUIRE_REHEARSAL",
  "REQUIRE_MANUAL_REVIEW","BLOCK","APPROVE_FOR_STAGING","APPROVE_FOR_CONTROLLED_VALIDATION"
] as const;
export const DEGRADED_MODES = ["NORMAL","DEGRADED","OBSERVE_ONLY","MANUAL_REVIEW","FROZEN","EMERGENCY_RESTRICTED"] as const;

type JsonMap = Record<string, unknown>;
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v as JsonMap).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const bounded=(n:number,max=100)=>Math.min(Math.max(Number.isFinite(n)?Math.floor(n):0,0),max);

export type SafetyEnvelope = {
  maxRiskClass: typeof RISK_CLASSES[number];
  minConfidence: typeof CONFIDENCE_LEVELS[number];
  maxBlastRadius: number;
  requiredControls: string[];
  forbiddenMutations: string[];
  protectedInvariants: string[];
  requireRollback: boolean;
  requireSimulation: boolean;
  requireApproval: boolean;
  expiresAt?: string;
};

export type AdaptationInput = {
  policyId:string;
  policyVersion:string;
  currentPolicy:Record<string,unknown>;
  proposedPolicy:Record<string,unknown>;
  affectedSystems:string[];
  evidence:unknown[];
  confidence:typeof CONFIDENCE_LEVELS[number];
  riskClass:typeof RISK_CLASSES[number];
  blastRadius:number;
  safetyEnvelope:SafetyEnvelope;
};

const riskRank:Record<typeof RISK_CLASSES[number],number>={LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4,PROHIBITED:5};
const confidenceRank:Record<typeof CONFIDENCE_LEVELS[number],number>={UNKNOWN:0,LOW:1,MEDIUM:2,HIGH:3,VERIFIED:4};

export function evaluateSafetyEnvelope(input:AdaptationInput){
  const e=input.safetyEnvelope;
  const violations:string[]=[];
  if(riskRank[input.riskClass]>riskRank[e.maxRiskClass])violations.push("RISK_CLASS_EXCEEDS_ENVELOPE");
  if(confidenceRank[input.confidence]<confidenceRank[e.minConfidence])violations.push("CONFIDENCE_BELOW_ENVELOPE");
  if(input.blastRadius>Math.max(0,e.maxBlastRadius))violations.push("BLAST_RADIUS_EXCEEDS_ENVELOPE");
  if(e.requireRollback&&!input.currentPolicy)violations.push("ROLLBACK_BASELINE_MISSING");
  const changed=Object.keys(input.proposedPolicy).filter(k=>JSON.stringify(input.proposedPolicy[k])!==JSON.stringify(input.currentPolicy[k]));
  const forbidden=e.forbiddenMutations.map(x=>x.toLowerCase());
  for(const key of changed){
    const lower=key.toLowerCase();
    if(forbidden.some(x=>lower.includes(x)))violations.push("FORBIDDEN_MUTATION:"+key);
  }
  if(e.protectedInvariants.length===0)violations.push("PROTECTED_INVARIANTS_MISSING");
  if(e.requiredControls.length===0)violations.push("REQUIRED_CONTROLS_MISSING");
  if(e.expiresAt&&Number.isNaN(new Date(e.expiresAt).getTime()))violations.push("INVALID_ENVELOPE_EXPIRY");
  const decision=violations.length?"BLOCK":"ALLOW";
  return {decision,violations,changedKeys:changed.slice(0,100),algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
}

export function assessAdaptation(input:AdaptationInput){
  const safety=evaluateSafetyEnvelope(input);
  const evidenceCount=input.evidence.length;
  if(safety.decision==="BLOCK")return {decision:"BLOCK",riskClass:input.riskClass,confidence:input.confidence,safety,reason:"Safety envelope violation",algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
  if(input.riskClass==="PROHIBITED")return {decision:"BLOCK",riskClass:input.riskClass,confidence:input.confidence,safety,reason:"Prohibited adaptation",algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
  if(evidenceCount===0||input.confidence==="UNKNOWN")return {decision:"COLLECT_MORE_EVIDENCE",riskClass:input.riskClass,confidence:input.confidence,safety,reason:"Evidence is insufficient",algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
  if(input.safetyEnvelope.requireSimulation||input.riskClass==="HIGH"||input.riskClass==="CRITICAL")return {decision:"REQUIRE_SIMULATION",riskClass:input.riskClass,confidence:input.confidence,safety,reason:"Simulation/rehearsal required by safety policy",algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
  if(input.safetyEnvelope.requireApproval||input.riskClass==="MEDIUM")return {decision:"REQUIRE_MANUAL_REVIEW",riskClass:input.riskClass,confidence:input.confidence,safety,reason:"Governance approval required",algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
  return {decision:"APPROVE_FOR_STAGING",riskClass:input.riskClass,confidence:input.confidence,safety,reason:"Within governed adaptation envelope",algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
}

export function detectAdaptationDrift(input:{certifiedPolicy:Record<string,unknown>;activePolicy:Record<string,unknown>;observedPolicy?:Record<string,unknown>}){
  const diffs=(a:Record<string,unknown>,b:Record<string,unknown>)=>[...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
  const configured=diffs(input.certifiedPolicy,input.activePolicy);
  const observed=input.observedPolicy?diffs(input.activePolicy,input.observedPolicy):[];
  return {configuredDrift:configured.length>0,observedDrift:observed.length>0,configuredDifferences:configured,observedDifferences:observed,algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
}

export function validateAdaptationEvidence(input:{safetyResult:ReturnType<typeof evaluateSafetyEnvelope>;simulationPassed:boolean;rollbackReady:boolean;dependenciesValid:boolean;auditPathAvailable:boolean}){
  const failures:string[]=[...input.safetyResult.violations];
  if(!input.simulationPassed)failures.push("SIMULATION_NOT_PASSED");
  if(!input.rollbackReady)failures.push("ROLLBACK_NOT_READY");
  if(!input.dependenciesValid)failures.push("DEPENDENCIES_INVALID");
  if(!input.auditPathAvailable)failures.push("AUDIT_PATH_UNAVAILABLE");
  return {status:failures.length?"BLOCKED":"VERIFIED",failures,algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
}

export async function createAdaptation(input:AdaptationInput & {actor:string; rationale:string; expectedBenefit:unknown; expectedRisk:unknown; rollbackStrategy:unknown; validationCriteria:unknown}){
  const assessment=assessAdaptation(input);
  if(assessment.decision==="BLOCK")throw new Error("Governed policy adaptation blocked by safety envelope.");
  const proposal=await createProposal({
    policyId:input.policyId,policyVersion:input.policyVersion,problem:"Governed policy adaptation",
    currentPolicy:input.currentPolicy,proposedPolicy:input.proposedPolicy,rationale:input.rationale,
    evidence:{adaptation:assessment,evidence:input.evidence.slice(0,100),safetyEnvelope:input.safetyEnvelope},
    expectedBenefit:input.expectedBenefit,expectedRisk:input.expectedRisk,affectedSystems:input.affectedSystems.slice(0,100),
    affectedPolicies:[input.policyId],affectedCustomers:[],affectedEnvironments:[],
    costImpact:{},operationalImpact:{},rollbackStrategy:input.rollbackStrategy,
    validationCriteria:{base:input.validationCriteria,safetyEnvelope:input.safetyEnvelope,algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION},
    simulationRequired:input.safetyEnvelope.requireSimulation||["HIGH","CRITICAL"].includes(input.riskClass),
    approvalRequired:input.safetyEnvelope.requireApproval||["MEDIUM","HIGH","CRITICAL"].includes(input.riskClass),
    rollbackCapability:input.safetyEnvelope.requireRollback,actor:input.actor
  });
  return {proposal,assessment,algorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION};
}

export async function validateAdaptation(input:{proposalId:string;actor:string;safetyResult:ReturnType<typeof evaluateSafetyEnvelope>;simulationPassed:boolean;rollbackReady:boolean;dependenciesValid:boolean;auditPathAvailable:boolean;correlationId:string}){
  const result=validateAdaptationEvidence(input);
  const record=await db.governancePolicyValidation.create({
    data:{proposalId:input.proposalId,validationType:"GOVERNANCE_ADAPTATION_SAFETY",status:result.status,evidence:json(result),checks:json({safetyEnvelope:input.safetyResult,simulationPassed:input.simulationPassed,rollbackReady:input.rollbackReady,dependenciesValid:input.dependenciesValid,auditPathAvailable:input.auditPathAvailable}),actor:input.actor,correlationId:input.correlationId}
  });
  return {record,result};
}

export async function transitionAdaptation(input:{proposalId:string;toState:AdaptationState;actor:string;reason:string;evidence:unknown;idempotencyKey:string}){
  if(!ADAPTATION_STATES.includes(input.toState))throw new Error("Unknown adaptation state.");
  return transitionProposal({proposalId:input.proposalId,toState:input.toState as Parameters<typeof transitionProposal>[0]["toState"],actor:input.actor,reason:input.reason,evidence:input.evidence,idempotencyKey:input.idempotencyKey});
}

export function buildSafetyEnvelope(input:Partial<SafetyEnvelope>):SafetyEnvelope{
  return {
    maxRiskClass:input.maxRiskClass??"MEDIUM",
    minConfidence:input.minConfidence??"HIGH",
    maxBlastRadius:Math.max(0,bounded(input.maxBlastRadius??3)),
    requiredControls:(input.requiredControls??[]).slice(0,50),
    forbiddenMutations:(input.forbiddenMutations??["payment","security","privacy","destructive database","qikink catalog","authentication"]).slice(0,50),
    protectedInvariants:(input.protectedInvariants??["payment safety","audit integrity","provider credential isolation","Qikink fulfillment-only","database safety","security controls"]).slice(0,50),
    requireRollback:input.requireRollback??true,
    requireSimulation:input.requireSimulation??false,
    requireApproval:input.requireApproval??true,
    expiresAt:input.expiresAt
  };
}

export const provenance={parentAlgorithmVersion:GOVERNANCE_ALGORITHM_VERSION,adaptationAlgorithmVersion:GOVERNANCE_ADAPTATION_ALGORITHM_VERSION,source:"Phase 15.41 governance intelligence; governed extension for Phase 15.42"};
