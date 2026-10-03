import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import type { PlatformCertificationReadiness } from "@prisma/client";
import { createQikinkFulfillmentProvider } from "@/lib/fulfillment/providers/qikink";
import { LOCKED_STACK, readinessFor, type CertificationFinding, type ReadinessState } from "./model";

function packageJson(){return JSON.parse(readFileSync(join(process.cwd(),"package.json"),"utf8")) as {version?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>;engines?:Record<string,string>;packageManager?:string};}
function dep(pkg:ReturnType<typeof packageJson>,name:string){return pkg.dependencies?.[name]??pkg.devDependencies?.[name]??null;}
function expectedRuntimeFindings(pkg:ReturnType<typeof packageJson>):CertificationFinding[]{

  const findings:CertificationFinding[]=[];
  const expected:[string,string|null,string,string][]=[
    ["next",dep(pkg,"next"),LOCKED_STACK.next,"Locked Next.js version drift."],
    ["react",dep(pkg,"react"),LOCKED_STACK.react,"Locked React version drift."],
    ["react-dom",dep(pkg,"react-dom"),LOCKED_STACK.reactDom,"Locked React DOM version drift."],
    ["typescript",dep(pkg,"typescript"),LOCKED_STACK.typescript,"Locked TypeScript version drift."],
    ["eslint",dep(pkg,"eslint"),LOCKED_STACK.eslint,"Locked ESLint version drift."],
    ["tailwindcss",dep(pkg,"tailwindcss"),LOCKED_STACK.tailwind,"Locked Tailwind CSS version drift."],
    ["prisma",dep(pkg,"prisma")??dep(pkg,"@prisma/client"),LOCKED_STACK.prisma,"Locked Prisma version drift."],
  ];
  for(const [name,actual,wanted,title] of expected){
    const normalized=actual?.replace(/^\^|^~/,"");
    if(normalized!==wanted) findings.push({id:"LOCKED_STACK_"+name.toUpperCase().replace(/[^A-Z0-9]/g,"_"),level:"BLOCKER",title,impact:"The final certification cannot assert the mandated runtime dependency baseline.",evidence:`package.json declares ${name}=${actual??"<missing>"}; required ${wanted}.`,owner:"release-engineering"});
  }
  return findings;
}
export async function getLatestPlatformCertification(){ return db.platformCertification.findFirst({orderBy:{timestamp:"desc"}}); }

export async function collectPlatformCertification(options:{persist?:boolean;evaluator?:string;environment?:string;commitSha?:string;deploymentId?:string}={}){
  const pkg=packageJson();
  const findings:CertificationFinding[]=[...expectedRuntimeFindings(pkg)];
  const qikink=createQikinkFulfillmentProvider();
  if(!qikink.capabilities.statusLookup){
    findings.push({id:"QIKINK_SHIPPING_STATUS_CONTRACT",level:"BLOCKER",title:"Provider shipping/tracking status contract is unavailable.",impact:"Shipment/tracking readiness cannot be certified end-to-end without a verified status lookup contract.",evidence:"Qikink adapter declares statusLookup=false; no verified provider-neutral shipment-status contract is available.",owner:"fulfillment/shipping"});
  }
  for(const path of ["docs/phase-15-18-business-continuity-operational-resilience.md","docs/phase-15-19-production-governance-compliance-evidence-audit-readiness.md","docs/phase-15-23-production-end-to-end-workflow-validation-synthetic-monitoring.md"]){
    if(!existsSync(join(process.cwd(),path))) findings.push({id:"MISSING_CERTIFICATION_DOCUMENT_"+path.replaceAll("/","_").replaceAll(".","_"),level:"HIGH",title:"Required certification evidence document is missing.",impact:"The corresponding control cannot be traced to repository evidence.",evidence:path,owner:"platform-governance"});
  }
  findings.push(
    {id:"PRODUCTION_BACKUP_PITR_EVIDENCE",level:"BLOCKER",title:"Production backup/PITR evidence is externally unverified.",impact:"Production RPO/RTO and recoverability cannot be certified from repository CI alone.",evidence:"Phase 15.18/15.19 evidence requires provider-level backup retention and PITR/restore evidence.",owner:"infrastructure"},
    {id:"PRODUCTION_SMOKE_EVIDENCE",level:"BLOCKER",title:"Approved production smoke-test evidence is unavailable.",impact:"The final go-live gate cannot claim production runtime health without non-destructive production evidence.",evidence:"Repository CI validates test infrastructure, not the live production deployment.",owner:"release-engineering"},
    {id:"PAYMENT_PRODUCTION_SAFE_VALIDATION",level:"BLOCKER",title:"Safe production payment validation contract is not evidenced.",impact:"Payment production readiness cannot be certified without a non-financial validation mechanism or independently verified production-safe boundary.",evidence:"Phase 15.24 prohibits real transactions; repository evidence does not establish an approved production payment certification path.",owner:"payments"},
    {id:"PRODUCTION_ENV_CONFIGURATION_EVIDENCE",level:"HIGH",title:"Production environment configuration cannot be independently certified from source.",impact:"Secrets, URLs, provider credentials, runtime settings and deployment configuration require deployment-environment evidence.",evidence:"Repository source validates required configuration shapes but cannot prove the live production values are correct or safely configured.",owner:"release-engineering"}
  );
  const readiness:ReadinessState=readinessFor(findings);
  const certificationId=`CERT-15.24-${new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)}-${randomUUID().slice(0,8).toUpperCase()}`;
  const testMatrix={
    architecture:"REPOSITORY_AUDIT",
    database:"CI_VALIDATION_REQUIRED",
    security:"CI_AND_REPOSITORY_AUDIT",
    payment:"PRODUCTION_SAFE_BOUNDARY_ONLY",
    fulfillment:"ADAPTER_BOUNDARY_VERIFIED",
    shipping:"BLOCKED_BY_PROVIDER_STATUS_CONTRACT",
    synthetic:"PHASE_15.23",
    backupDr:"EXTERNAL_EVIDENCE_REQUIRED",
    productionSmoke:"EXTERNAL_EVIDENCE_REQUIRED",
    ci:"MAIN_CI_532_GREEN",
  };
  const record={certificationId,releaseVersion:pkg.version??"unknown",commitSha:options.commitSha??process.env.COMMIT_REF??null,deploymentId:options.deploymentId??process.env.NETLIFY_DEPLOY_ID??null,environment:options.environment??(process.env.NODE_ENV==="production"?"PRODUCTION":"CI"),timestamp:new Date().toISOString(),evaluator:options.evaluator??"platform-certification-engine",testMatrix,findings,readiness};
  if(options.persist){
    await db.platformCertification.create({data:{certificationId,releaseVersion:record.releaseVersion,commitSha:record.commitSha,deploymentId:record.deploymentId,environment:record.environment,evaluator:record.evaluator,readiness:readiness as PlatformCertificationReadiness,testMatrix,results:{findings},blockers:findings.filter(f=>f.level==="BLOCKER"),limitations:findings.filter(f=>f.level!=="BLOCKER"),evidence:{source:"platform-certification-engine",phase:"15.24"}}});
  }
  return record;
}
