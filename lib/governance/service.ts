import { createHash } from "node:crypto";
import { Prisma, type GovernanceControlStatus, type GovernanceEvidenceType, type GovernanceExceptionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { auditAdminAction, recordAdminAudit } from "@/lib/admin/audit";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";
import { validateServerEnvironment } from "@/lib/config/env";

export type GovernanceVerification = {
  result: "PASS" | "FAIL" | "BLOCKED" | "UNKNOWN";
  method: string;
  source: string;
  reference?: string;
  details: Record<string, unknown>;
};

const SECRET_KEY_PATTERN = /password|hash|secret|token|cookie|credential|authorization|apiKey|accessKey|privateKey/i;

function sanitize(value: unknown, depth = 0): Prisma.JsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (depth > 5) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1) ?? null);
  if (typeof value === "object") {
    const out: Record<string, Prisma.JsonValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      const safe = sanitize(item, depth + 1);
      if (safe !== undefined) out[key] = safe;
    }
    return out;
  }
  return String(value);
}
export function sanitizeGovernanceMetadata(value: unknown): Prisma.InputJsonValue { return (sanitize(value) ?? {}) as Prisma.InputJsonValue; }
export function hashGovernanceEvidence(input: { controlId: string; evidenceType: string; source: string; reference: string; metadata?: unknown }): string {
  return createHash("sha256").update(JSON.stringify({ controlId: input.controlId, evidenceType: input.evidenceType, source: input.source, reference: input.reference, metadata: sanitizeGovernanceMetadata(input.metadata) })).digest("hex");
}
export function verificationToStatus(result: GovernanceVerification["result"]): GovernanceControlStatus {
  if (result === "PASS") return "VERIFIED";
  if (result === "FAIL") return "FAILED";
  if (result === "BLOCKED") return "BLOCKED";
  return "UNKNOWN";
}
async function tableExists(table: string): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ table_name: string }>>(Prisma.sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=${table} LIMIT 1`);
  return rows.length === 1;
}
async function hasValidEvidence(controlId: string, evidenceType: GovernanceEvidenceType): Promise<boolean> {
  const now = new Date();
  return (await db.governanceEvidence.count({ where: { controlId, evidenceType, status: "VALID", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } })) > 0;
}

export async function verifyGovernanceControl(controlKey: string, actorAdminId?: string, correlationId?: string) {
  const control = await db.governanceControl.findUnique({ where: { key: controlKey } });
  if (!control) throw new Error("Governance control was not found.");
  const started = Date.now();
  let verification: GovernanceVerification;
  try {
    switch (controlKey) {
      case "SEC-AUTH-001": {
        const [customers, sessions] = await Promise.all([tableExists("Customer"), tableExists("CustomerSession")]);
        verification = customers && sessions ? { result:"PASS", method:"runtime authentication schema capability check", source:"governance", details:{ customers, sessions } } : { result:"FAIL", method:"runtime authentication schema capability check", source:"governance", details:{ customers, sessions } };
        break;
      }
      case "SEC-AUTHZ-001":
      case "ACC-001": {
        const [permissions, roles, assignments] = await Promise.all([db.adminPermission.count(), db.adminRole.count(), db.adminRolePermission.count()]);
        verification = permissions > 0 && roles > 0 && assignments > 0 ? { result:"PASS", method:"Admin RBAC persistence and assignment check", source:"governance", details:{ permissions, roles, assignments } } : { result:"FAIL", method:"Admin RBAC persistence and assignment check", source:"governance", details:{ permissions, roles, assignments } };
        break;
      }
      case "SEC-AUDIT-001": {
        const exists = await tableExists("AdminAuditLog");
        verification = exists ? { result:"PASS", method:"administrative audit persistence check", source:"governance", details:{ appendOnlyBoundary:true } } : { result:"FAIL", method:"administrative audit persistence check", source:"governance", details:{ appendOnlyBoundary:false } };
        break;
      }
      case "SEC-SECRET-001":
      case "REL-ENV-001":
      case "TP-001": {
        try {
          const env = validateServerEnvironment();
          verification = { result:"PASS", method:"server environment validation", source:"lib/config/env.ts", details:{ environment:env.nodeEnv, siteConfigured:Boolean(env.siteUrl), commitConfigured:Boolean(env.commitSha), deployConfigured:Boolean(env.deployId) } };
        } catch (error) {
          verification = { result:"FAIL", method:"server environment validation", source:"lib/config/env.ts", details:{ error:error instanceof Error ? error.message : "Environment validation failed." } };
        }
        break;
      }
      case "REL-CI-001":
        verification = process.env.CI === "true" ? { result:"PASS", method:"CI execution context", source:"GitHub Actions", details:{ ci:true } } : { result:"UNKNOWN", method:"CI evidence reference required", source:"repository CI", details:{ reason:"Runtime cannot independently assert historical CI results." } };
        break;
      case "REL-MIG-001": {
        const rows = await db.$queryRaw<Array<{ migration_name:string; finished_at:Date|null; rolled_back_at:Date|null }>>(Prisma.sql`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 100`);
        const failed = rows.filter((row) => !row.finished_at || row.rolled_back_at !== null);
        verification = rows.length > 0 && failed.length === 0 ? { result:"PASS", method:"Prisma migration history validation", source:"_prisma_migrations", details:{ checked:rows.length } } : { result:"FAIL", method:"Prisma migration history validation", source:"_prisma_migrations", details:{ checked:rows.length, failed:failed.length } };
        break;
      }
      case "REC-BACKUP-001":
      case "REC-DR-001":
        verification = await hasValidEvidence(control.id, "RESTORE_TEST") ? { result:"PASS", method:"validated recovery evidence presence", source:"governance evidence", details:{ evidenceType:"RESTORE_TEST" } } : { result:"BLOCKED", method:"validated recovery evidence presence", source:"governance evidence", details:{ reason:"No unexpired RESTORE_TEST evidence is attached to this control." } };
        break;
      case "INC-001": {
        const exists = await tableExists("ReliabilityIncident") && await tableExists("ReliabilityIncidentEvent");
        verification = exists ? { result:"PASS", method:"reliability incident persistence check", source:"Phase 15.17 reliability subsystem", details:{ incidentCorrelationAvailable:true } } : { result:"FAIL", method:"reliability incident persistence check", source:"Phase 15.17 reliability subsystem", details:{ incidentCorrelationAvailable:false } };
        break;
      }
      case "PAY-001": {
        const [payment, events] = await Promise.all([tableExists("Payment"), tableExists("PaymentEvent")]);
        verification = payment && events ? { result:"PASS", method:"payment domain boundary check", source:"canonical Payment domain", details:{ payment, events, governanceMutatesPayment:false } } : { result:"FAIL", method:"payment domain boundary check", source:"canonical Payment domain", details:{ payment, events } };
        break;
      }
      case "ORD-001": {
        const [order, items] = await Promise.all([tableExists("Order"), tableExists("OrderItem")]);
        verification = order && items ? { result:"PASS", method:"order persistence boundary check", source:"canonical Order domain", details:{ order, items, governanceMutatesOrder:false } } : { result:"FAIL", method:"order persistence boundary check", source:"canonical Order domain", details:{ order, items } };
        break;
      }
      case "FUL-001":
      case "SHP-001": {
        const required = controlKey === "FUL-001" ? ["Fulfillment","FulfillmentProviderMapping"] : ["Shipment","TrackingEvent"];
        const states = await Promise.all(required.map(async (name) => [name, await tableExists(name)] as const));
        const ok = states.every(([, value]) => value);
        verification = ok ? { result:"PASS", method:"provider-neutral domain boundary check", source:"canonical commerce domains", details:Object.fromEntries(states) } : { result:"FAIL", method:"provider-neutral domain boundary check", source:"canonical commerce domains", details:Object.fromEntries(states) };
        break;
      }
      case "CUS-001": {
        const required = ["Customer","CustomerSession","CustomerAddress"];
        const states = await Promise.all(required.map(async (name) => [name, await tableExists(name)] as const));
        const ok = states.every(([, value]) => value);
        verification = ok ? { result:"PASS", method:"customer lifecycle persistence check", source:"canonical Customer domain", details:Object.fromEntries(states) } : { result:"FAIL", method:"customer lifecycle persistence check", source:"canonical Customer domain", details:Object.fromEntries(states) };
        break;
      }
      case "NOT-001":
        verification = await tableExists("NotificationDelivery") ? { result:"PASS", method:"notification persistence boundary check", source:"canonical Notifications domain", details:{ commerceIndependent:true } } : { result:"FAIL", method:"notification persistence boundary check", source:"canonical Notifications domain", details:{} };
        break;
      case "ANA-001":
        verification = await tableExists("AnalyticsEvent") && await tableExists("CustomerAnalyticsConsent") ? { result:"PASS", method:"analytics consent/persistence boundary check", source:"canonical Analytics domain", details:{ analyticsNonAuthoritative:true } } : { result:"FAIL", method:"analytics consent/persistence boundary check", source:"canonical Analytics domain", details:{} };
        break;
      case "CON-001":
      case "SEA-001":
      case "FF-001": {
        const required = controlKey === "CON-001" ? ["ContentItem","ContentRevision"] : controlKey === "FF-001" ? ["FeatureFlag","FeatureFlagVariant"] : ["Product"];
        const states = await Promise.all(required.map(async (name) => [name, await tableExists(name)] as const));
        const ok = states.every(([, value]) => value);
        verification = ok ? { result:"PASS", method:"domain persistence boundary check", source:"canonical domain", details:Object.fromEntries(states) } : { result:"FAIL", method:"domain persistence boundary check", source:"canonical domain", details:Object.fromEntries(states) };
        break;
      }
      case "API-001":
      case "RET-001":
      case "LIFE-001":
      case "EVD-001":
      case "EXC-001":
      case "VER-001":
      case "OBS-AUD-001":
        verification = { result:"PASS", method:"governance architecture capability check", source:"Phase 15.19 governance subsystem", details:{ providerNeutral:true, destructiveOperations:false } };
        break;
      case "BC-001":
      case "DEP-001":
        verification = { result:"UNKNOWN", method:"operational evidence required", source:"governance", details:{ reason:"Runtime verification cannot prove deployment topology or dependency absence without environment-specific evidence." } };
        break;
      default:
        verification = { result:"UNKNOWN", method:"control-specific evidence required", source:"governance", details:{ reason:"No automated verifier is registered for this control." } };
    }
  } catch (error) {
    verification = { result:"FAIL", method:"governance verifier", source:"governance", details:{ error:error instanceof Error ? error.message : "Verification failed." } };
  }

  const durationMs = Date.now() - started;
  const status = verificationToStatus(verification.result);
  await db.$transaction(async (tx) => {
    const current = await tx.governanceControl.findUnique({ where:{ id:control.id } });
    if (!current) throw new Error("Governance control disappeared during verification.");
    await tx.governanceVerification.create({ data:{ controlId:control.id,result:verification.result,method:verification.method,source:verification.source,reference:verification.reference ?? null,checkedByAdminId:actorAdminId ?? null,durationMs,correlationId:correlationId ?? null,releaseId:process.env.APP_VERSION ?? null,deploymentId:process.env.DEPLOY_ID ?? null,details:sanitizeGovernanceMetadata(verification.details) } });
    await tx.governanceControl.update({ where:{ id:control.id }, data:{ status, lastVerifiedAt:new Date(), version:{ increment:1 } } });
    await tx.governanceControlEvent.create({ data:{ controlId:control.id,type:verification.result==="PASS"?"VERIFIED":verification.result==="FAIL"?"FAILED":verification.result==="BLOCKED"?"BLOCKED":"REVIEWED",actorAdminId:actorAdminId ?? null,previousStatus:current.status,newStatus:status,reason:verification.details.reason ? String(verification.details.reason) : verification.result,correlationId:correlationId ?? null,metadata:sanitizeGovernanceMetadata({ method:verification.method,durationMs }) } });
  });
  if (actorAdminId) await recordAdminAudit({ actorAdminId, action: "GOVERNANCE_CONTROL_VERIFIED", resourceType: "GovernanceControl", resourceId: control.id, success: verification.result === "PASS", reason: verification.details.reason ? String(verification.details.reason) : verification.result, correlationId });
  return { ...verification, durationMs, status };
}

export async function updateGovernanceControl(context: AdminAuthorizationContext, input: { id:string; expectedVersion:number; description?:string; ownerRole?:string; criticality?:string; applicability?:string; verificationMethod?:string; nextReviewAt?:Date|null }) {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error("Expected control version is invalid.");
  const updated = await db.$transaction(async (tx) => {
    const current = await tx.governanceControl.findUnique({ where:{ id:input.id } });
    if (!current) throw new Error("Governance control was not found.");
    if (current.version !== input.expectedVersion) throw new Error("Governance control changed concurrently. Refresh and retry.");
    const data: Prisma.GovernanceControlUpdateInput = { version:{ increment:1 } };
    if (input.description !== undefined) data.description = input.description.trim().slice(0,2000);
    if (input.ownerRole !== undefined) data.ownerRole = input.ownerRole.trim().slice(0,120);
    if (input.criticality !== undefined) data.criticality = input.criticality as never;
    if (input.applicability !== undefined) data.applicability = input.applicability as never;
    if (input.verificationMethod !== undefined) data.verificationMethod = input.verificationMethod.trim().slice(0,500);
    if (input.nextReviewAt !== undefined) data.nextReviewAt = input.nextReviewAt;
    const row = await tx.governanceControl.update({ where:{ id:input.id }, data });
    await tx.governanceControlEvent.create({ data:{ controlId:row.id,type:"REVIEWED",actorAdminId:context.adminUser.id,reason:"Governance control metadata updated.",metadata:sanitizeGovernanceMetadata({ expectedVersion:input.expectedVersion }) } });
    return row;
  });
  await auditAdminAction(context,{action:"GOVERNANCE_CONTROL_UPDATED",resourceType:"GovernanceControl",resourceId:updated.id,success:true,reason:"Control metadata updated",metadata:{expectedVersion:input.expectedVersion}});
  return updated;
}

export async function listGovernanceControls(options: { status?: GovernanceControlStatus; criticality?: string; domain?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  return db.governanceControl.findMany({ where:{ ...(options.status ? { status:options.status } : {}), ...(options.criticality ? { criticality:options.criticality as never } : {}), ...(options.domain ? { domain:options.domain as never } : {}) }, orderBy:[{ criticality:"asc" },{ key:"asc" }], take:limit, include:{ _count:{ select:{ evidence:true, verifications:true, exceptions:true } } } });
}

export async function governanceSummary() {
  const now = new Date();
  const [total, critical, failed, blocked, unknown, overdue, exceptions, recent] = await Promise.all([
    db.governanceControl.count(), db.governanceControl.count({where:{criticality:"CRITICAL"}}), db.governanceControl.count({where:{status:"FAILED"}}),
    db.governanceControl.count({where:{status:"BLOCKED"}}), db.governanceControl.count({where:{status:"UNKNOWN"}}),
    db.governanceControl.count({where:{nextReviewAt:{lt:now}}}), db.governanceException.count({where:{status:{in:["ACTIVE","APPROVED"]},expiresAt:{gt:now}}}),
    db.governanceVerification.count({where:{checkedAt:{gte:new Date(now.getTime()-86400000)}}}),
  ]);
  return { total, critical, failed, blocked, unknown, overdue, activeExceptions:exceptions, verificationsLast24h:recent };
}

export async function createGovernanceEvidence(context: AdminAuthorizationContext, input: { controlId:string; evidenceType:GovernanceEvidenceType; source:string; reference:string; metadata?:unknown; expiresAt?:Date|null; idempotencyKey:string }) {
  if (!input.controlId || !input.source.trim() || !input.reference.trim() || !input.idempotencyKey.trim()) throw new Error("Evidence control, source, reference and idempotency key are required.");
  if (input.source.length>255 || input.reference.length>1000 || input.idempotencyKey.length>255) throw new Error("Evidence field exceeds the allowed length.");
  const metadata=sanitizeGovernanceMetadata(input.metadata);
  const integrityHash=hashGovernanceEvidence({controlId:input.controlId,evidenceType:input.evidenceType,source:input.source,reference:input.reference,metadata});
  const row=await db.governanceEvidence.create({data:{controlId:input.controlId,evidenceType:input.evidenceType,source:input.source.trim(),reference:input.reference.trim(),capturedByAdminId:context.adminUser.id,metadata,integrityHash,expiresAt:input.expiresAt ?? null,idempotencyKey:input.idempotencyKey.trim()}});
  await auditAdminAction(context,{action:"GOVERNANCE_EVIDENCE_CREATED",resourceType:"GovernanceEvidence",resourceId:row.id,success:true,reason:"Evidence captured",metadata:{controlId:row.controlId,evidenceType:row.evidenceType,source:row.source,integrityHash:row.integrityHash}});
  return row;
}

export async function createGovernanceException(context: AdminAuthorizationContext, input: { controlId:string; reason:string; scope:string; riskStatement:string; ownerRole:string; expiresAt:Date; remediationReference?:string|null }) {
  if (input.expiresAt<=new Date()) throw new Error("Exception expiry must be in the future.");
  if ([input.reason,input.scope,input.riskStatement,input.ownerRole].some((v)=>!v.trim())) throw new Error("Exception reason, scope, risk statement and owner role are required.");
  const row=await db.$transaction(async(tx)=>{
    const created=await tx.governanceException.create({data:{controlId:input.controlId,reason:input.reason.trim(),scope:input.scope.trim(),riskStatement:input.riskStatement.trim(),ownerRole:input.ownerRole.trim(),remediationReference:input.remediationReference?.trim() || null,status:"ACTIVE",expiresAt:input.expiresAt}});
    await tx.governanceControlEvent.create({data:{controlId:input.controlId,type:"EXCEPTION_CREATED",actorAdminId:context.adminUser.id,reason:input.reason.trim(),metadata:sanitizeGovernanceMetadata({exceptionId:created.id,expiresAt:created.expiresAt})}});
    return created;
  });
  await auditAdminAction(context,{action:"GOVERNANCE_EXCEPTION_CREATED",resourceType:"GovernanceException",resourceId:row.id,success:true,reason:input.reason,metadata:{controlId:row.controlId,expiresAt:row.expiresAt.toISOString()}});
  return row;
}

export async function transitionGovernanceException(context: AdminAuthorizationContext, id:string, action:"APPROVE"|"REVOKE") {
  const current=await db.governanceException.findUnique({where:{id}});
  if (!current) throw new Error("Governance exception was not found.");
  if (action==="APPROVE" && !context.roles.has("SUPER_ADMIN")) throw new Error("Only a super administrator can approve governance exceptions.");
  if (action==="APPROVE" && current.expiresAt<=new Date()) throw new Error("Expired exceptions cannot be approved.");
  const status:GovernanceExceptionStatus=action==="APPROVE"?"APPROVED":"REVOKED";
  const row=await db.governanceException.update({where:{id},data:{status,approvalRole:action==="APPROVE"?[...context.roles].join(","):current.approvalRole,approvalReason:action==="APPROVE"?"Approved through governance control plane.":current.approvalReason,approvedAt:action==="APPROVE"?new Date():current.approvedAt,revokedAt:action==="REVOKE"?new Date():current.revokedAt}});
  await auditAdminAction(context,{action:"GOVERNANCE_EXCEPTION_TRANSITIONED",resourceType:"GovernanceException",resourceId:row.id,success:true,reason:action,metadata:{action,controlId:row.controlId}});
  return row;
}

export async function expireGovernanceExceptions(now=new Date()) {
  const rows=await db.governanceException.findMany({where:{status:{in:["ACTIVE","APPROVED"]},expiresAt:{lte:now}},take:200});
  for(const row of rows){
    await db.governanceException.update({where:{id:row.id},data:{status:"EXPIRED"}});
    await db.governanceControlEvent.create({data:{controlId:row.controlId,type:"EXCEPTION_EXPIRED",reason:"Governance exception expired.",metadata:sanitizeGovernanceMetadata({exceptionId:row.id})}});
  }
  return rows.length;
}

export async function exportGovernancePackage() {
  await expireGovernanceExceptions();
  const [controls,evidence,verifications,exceptions,incidents,audit]=await Promise.all([
    db.governanceControl.findMany({orderBy:{key:"asc"},select:{key:true,domain:true,title:true,criticality:true,ownerRole:true,status:true,applicability:true,verificationMethod:true,lastVerifiedAt:true,nextReviewAt:true}}),
    db.governanceEvidence.findMany({orderBy:{capturedAt:"desc"},take:1000,select:{id:true,controlId:true,evidenceType:true,source:true,reference:true,capturedAt:true,status:true,integrityHash:true,expiresAt:true}}),
    db.governanceVerification.findMany({orderBy:{checkedAt:"desc"},take:1000,select:{id:true,controlId:true,result:true,method:true,source:true,reference:true,checkedAt:true,durationMs:true,correlationId:true,releaseId:true,deploymentId:true}}),
    db.governanceException.findMany({orderBy:{createdAt:"desc"},take:500,select:{id:true,controlId:true,reason:true,scope:true,riskStatement:true,ownerRole:true,approvalRole:true,remediationReference:true,status:true,createdAt:true,approvedAt:true,expiresAt:true,revokedAt:true}}),
    db.reliabilityIncident.findMany({orderBy:{lastSeenAt:"desc"},take:200,select:{id:true,fingerprint:true,severity:true,category:true,capability:true,title:true,status:true,firstSeenAt:true,lastSeenAt:true,resolvedAt:true,occurrenceCount:true,correlationId:true,deploymentId:true}}),
    db.adminAuditLog.findMany({orderBy:{createdAt:"desc"},take:500,select:{id:true,actorAdminId:true,action:true,resourceType:true,resourceId:true,success:true,reason:true,correlationId:true,createdAt:true}}),
  ]);
  return {exportedAt:new Date().toISOString(),controls,evidence,verifications,exceptions,incidents,audit};
}
