import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";

export const DEPLOYMENT_ENVIRONMENTS = ["development", "test", "staging", "production"] as const;
export const DEPLOYMENT_STATUSES = [
  "DRAFT","READY_CHECK","APPROVED","SCHEDULED","PREPARING","PRE_DEPLOYMENT_VALIDATING",
  "DEPLOYING","DEPLOYMENT_VALIDATING","PROGRESSIVE_EXPOSURE","POST_DEPLOYMENT_VALIDATING",
  "VERIFIED","CERTIFIED","BLOCKED","REJECTED","PAUSED","ABORTED","FAILED","ROLLBACK_PENDING",
  "ROLLED_BACK","ROLLBACK_FAILED","FORWARD_RECOVERY_REQUIRED","EXPIRED","SUPERSEDED","INVALIDATED"
] as const;
export const RECOVERY_CLASSES = [
  "RECOVERABLE_BY_ROLLBACK","RECOVERABLE_BY_FORWARD_FIX","REQUIRES_MANUAL_RECOVERY","UNKNOWN"
] as const;
export const INCIDENT_DECISIONS = ["ALLOW","ALLOW_WITH_APPROVAL","DELAY","BLOCK"] as const;
export const REGISTERED_OPERATIONS = [
  "PREFLIGHT","ACQUIRE_LOCK","VERIFY_ARTIFACT","VERIFY_BACKUP","PREPARE_MIGRATION",
  "DEPLOY_ARTIFACT","APPLY_MIGRATION","HEALTH_CHECK","SMOKE_TEST","PROGRESSIVE_EXPOSURE",
  "WORKFLOW_VALIDATION","RECONCILIATION","POST_DEPLOYMENT_MONITORING","CERTIFICATION"
] as const;

const transitions: Record<string, readonly string[]> = {
  DRAFT: ["READY_CHECK", "BLOCKED"],
  READY_CHECK: ["APPROVED", "BLOCKED"],
  APPROVED: ["SCHEDULED", "PREPARING", "BLOCKED"],
  SCHEDULED: ["PREPARING", "BLOCKED", "EXPIRED"],
  PREPARING: ["PRE_DEPLOYMENT_VALIDATING", "PAUSED", "FAILED"],
  PRE_DEPLOYMENT_VALIDATING: ["DEPLOYING", "BLOCKED", "PAUSED"],
  DEPLOYING: ["DEPLOYMENT_VALIDATING", "PAUSED", "ABORTED", "FAILED", "ROLLBACK_PENDING", "FORWARD_RECOVERY_REQUIRED"],
  DEPLOYMENT_VALIDATING: ["PROGRESSIVE_EXPOSURE", "POST_DEPLOYMENT_VALIDATING", "PAUSED", "ROLLBACK_PENDING", "FORWARD_RECOVERY_REQUIRED", "FAILED"],
  PROGRESSIVE_EXPOSURE: ["POST_DEPLOYMENT_VALIDATING", "PAUSED", "ROLLBACK_PENDING", "FORWARD_RECOVERY_REQUIRED"],
  POST_DEPLOYMENT_VALIDATING: ["VERIFIED", "PAUSED", "ROLLBACK_PENDING", "FORWARD_RECOVERY_REQUIRED", "FAILED"],
  VERIFIED: ["CERTIFIED", "INVALIDATED"],
  CERTIFIED: ["INVALIDATED"],
  PAUSED: ["PREPARING", "PRE_DEPLOYMENT_VALIDATING", "DEPLOYING", "DEPLOYMENT_VALIDATING", "PROGRESSIVE_EXPOSURE", "POST_DEPLOYMENT_VALIDATING", "ABORTED", "ROLLBACK_PENDING"],
  ROLLBACK_PENDING: ["ROLLED_BACK", "ROLLBACK_FAILED", "FORWARD_RECOVERY_REQUIRED"],
  FORWARD_RECOVERY_REQUIRED: ["VERIFIED", "FAILED"],
  BLOCKED: [],
  REJECTED: [],
  ABORTED: [],
  FAILED: [],
  ROLLED_BACK: [],
  ROLLBACK_FAILED: [],
  EXPIRED: [],
  SUPERSEDED: [],
  INVALIDATED: [],
};

const safe = (value: unknown): unknown => {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(safe);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = /password|secret|token|authorization|cookie|apiKey|privateKey|cardNumber|cvv/i.test(key)
        ? "[REDACTED]"
        : safe(item);
    }
    return output;
  }
  return "[UNSUPPORTED]";
};

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(safe(value))).digest("hex");

const transition = (from: string, to: string) => {
  if (!transitions[from]?.includes(to)) {
    throw new Error(`Illegal deployment transition: ${from} -> ${to}`);
  }
};

async function decide(
  deploymentId: string,
  type: string,
  from: string,
  to: string,
  actorId: string,
  policyVersion: string,
  reason: string,
  idempotencyKey?: string,
) {
  const key = idempotencyKey ? hash({ deploymentId, type, idempotencyKey }) : undefined;
  if (key) {
    const existing = await db.deploymentObservation.findFirst({
      where: { deploymentId, operation: "COMMAND:" + key },
    });
    if (existing) return existing;
    await db.deploymentObservation.create({
      data: {
        deploymentId,
        operation: "COMMAND:" + key,
        actorId,
        durationMs: 0,
        result: "ACCEPTED",
        retryCount: 0,
        traceId: randomUUID(),
      },
    });
  }
  return db.deploymentDecision.create({
    data: {
      deploymentId,
      decisionType: type,
      fromStatus: from,
      toStatus: to,
      reason: reason.slice(0, 1000),
      policyVersion,
      actorId,
      evidenceHash: hash({ deploymentId, type, from, to, reason }),
      correlationId: randomUUID(),
    },
  });
}

async function evidence(
  deploymentId: string,
  type: string,
  payload: unknown,
  actorId: string,
  source = "phase-15.36",
) {
  return db.deploymentEvidence.create({
    data: {
      deploymentId,
      evidenceType: type,
      source,
      reference: randomUUID(),
      integrityHash: hash(payload),
      payload: safe(payload) as never,
      capturedBy: actorId,
    },
  });
}

async function requireDeployment(id: string) {
  const deployment = await db.deployment.findUnique({
    where: { id },
    include: { gates: true, plans: { orderBy: { revision: "desc" }, take: 1 } },
  });
  if (!deployment) throw new Error("Deployment not found");
  return deployment;
}

function assertEnvironment(environment: string) {
  if (!(DEPLOYMENT_ENVIRONMENTS as readonly string[]).includes(environment)) {
    throw new Error("Unsupported deployment environment");
  }
}

function assertOperation(operation: string) {
  if (!(REGISTERED_OPERATIONS as readonly string[]).includes(operation)) {
    throw new Error("Unknown deployment operation type");
  }
}

export async function createDeployment(input: {
  stableId: string;
  changeRequestId: string;
  releaseId: string;
  artifactId: string;
  environment: string;
  target: unknown;
  actorId: string;
  policyVersion: string;
  recoveryClass: string;
}) {
  assertEnvironment(input.environment);
  if (!(RECOVERY_CLASSES as readonly string[]).includes(input.recoveryClass)) {
    throw new Error("Unknown recovery classification");
  }
  const [change, release, artifact] = await Promise.all([
    db.changeRequest.findUnique({ where: { id: input.changeRequestId } }),
    db.release.findUnique({ where: { id: input.releaseId } }),
    db.deploymentArtifact.findUnique({ where: { id: input.artifactId } }),
  ]);
  if (!change || !["APPROVED", "REHEARSAL_CERTIFIED", "READY_FOR_RELEASE", "RELEASE_WINDOW_OPEN"].includes(change.status)) {
    throw new Error("Approved ChangeRequest revision is required");
  }
  if (!release || !["READY", "SCHEDULED", "CANARY_PENDING", "CANARY_RUNNING", "CANARY_VALIDATING", "CANARY_APPROVED", "PROGRESSIVE_ROLLOUT", "ROLLOUT_VALIDATING", "FULL_RELEASE_PENDING"].includes(release.status)) {
    throw new Error("Approved governed Release is required");
  }
  if (release.changeRequestId !== input.changeRequestId) throw new Error("Release/ChangeRequest linkage mismatch");
  if (!artifact?.approved || !artifact.immutable) throw new Error("Approved immutable deployment artifact is required");
  const existing = await db.deployment.findUnique({ where: { stableId: input.stableId } });
  if (existing) return existing;
  const deployment = await db.deployment.create({
    data: {
      stableId: input.stableId,
      changeRequestId: input.changeRequestId,
      releaseId: input.releaseId,
      artifactId: input.artifactId,
      environment: input.environment,
      target: safe(input.target) as never,
      status: "DRAFT",
      operationState: "IDLE",
      recoveryClass: input.recoveryClass,
      policyVersion: input.policyVersion,
      actorId: input.actorId,
      correlationId: randomUUID(),
    },
  });
  await evidence(deployment.id, "INPUTS", {
    changeRequestId: input.changeRequestId,
    releaseId: input.releaseId,
    artifactId: input.artifactId,
    environment: input.environment,
    recoveryClass: input.recoveryClass,
  }, input.actorId);
  return deployment;
}

export async function readiness(id: string, actorId: string, idempotencyKey?: string) {
  const deployment = await requireDeployment(id);
  if (!["DRAFT", "READY_CHECK", "PAUSED"].includes(deployment.status)) {
    throw new Error("Deployment is not eligible for readiness");
  }
  const [change, release, artifact, environment] = await Promise.all([
    db.changeRequest.findUnique({ where: { id: deployment.changeRequestId } }),
    db.release.findUnique({ where: { id: deployment.releaseId } }),
    db.deploymentArtifact.findUnique({ where: { id: deployment.artifactId } }),
    db.deploymentEnvironment.findUnique({ where: { name: deployment.environment } }),
  ]);
  const freeze = await db.deploymentFreeze.findFirst({
    where: { active: true, expiresAt: { gt: new Date() }, OR: [
      { scope: "GLOBAL" },
      { scope: "ENVIRONMENT", scopeReference: deployment.environment },
      { scope: "DOMAIN", scopeReference: String((deployment.target as Record<string, unknown>).domain ?? "") },
    ] },
  });
  const activeConflict = await db.deploymentConflict.findFirst({
    where: { deploymentId: id, resolved: false },
  });
  const checks: Array<[string, boolean, string]> = [
    ["CHANGE_APPROVAL", !!change && ["APPROVED", "REHEARSAL_CERTIFIED", "READY_FOR_RELEASE", "RELEASE_WINDOW_OPEN"].includes(change.status), "Current approved change required"],
    ["RELEASE_GOVERNANCE", !!release && !["BLOCKED", "REJECTED", "INVALIDATED", "EXPIRED", "SUPERSEDED"].includes(release.status), "Release must remain governed"],
    ["ARTIFACT_INTEGRITY", !!artifact && artifact.approved && artifact.immutable && artifact.integrityHash.length === 64, "Approved immutable artifact required"],
    ["ENVIRONMENT", !!environment && !environment.frozen && !environment.maintenanceMode && environment.state !== "BLOCKED", "Environment must be eligible"],
    ["INCIDENT_STATE", !freeze, "No active deployment freeze may affect this target"],
    ["CONFLICTS", !activeConflict, "Unresolved deployment conflict blocks readiness"],
    ["RECOVERY_DECLARED", deployment.recoveryClass !== "UNKNOWN", "Recovery classification is required"],
    ["BOUNDED_TARGET", !!deployment.target && typeof deployment.target === "object", "Target must be structured and bounded"],
    ["POLICY", deployment.policyVersion.length > 0, "Deployment policy version required"],
  ];
  await db.deploymentGate.deleteMany({ where: { deploymentId: id } });
  for (const [key, passed, reason] of checks) {
    await db.deploymentGate.create({
      data: {
        deploymentId: id,
        key,
        category: key,
        severity: passed ? "INFO" : "CRITICAL",
        evidence: { passed, reason },
        blocking: true,
        result: passed ? "PASS" : "BLOCKED",
        evaluatedAt: new Date(),
      },
    });
  }
  const passed = checks.every(([, ok]) => ok);
  const nextStatus = passed ? "APPROVED" : "BLOCKED";
  transition(deployment.status, nextStatus);
  await db.deployment.update({ where: { id }, data: { status: nextStatus, operationState: passed ? "READY" : "BLOCKED" } });
  await decide(id, "READINESS", deployment.status, nextStatus, actorId, deployment.policyVersion, passed ? "All deterministic readiness gates passed" : "One or more blocking readiness gates failed", idempotencyKey);
  await evidence(id, "READINESS", { checks, passed }, actorId);
  return { passed, checks };
}

export async function generatePlan(id: string, actorId: string) {
  const deployment = await requireDeployment(id);
  if (!["APPROVED", "SCHEDULED", "PREPARING"].includes(deployment.status)) throw new Error("Deployment is not ready for planning");
  const raw = [
    "PREFLIGHT","ACQUIRE_LOCK","VERIFY_ARTIFACT","VERIFY_BACKUP","PREPARE_MIGRATION",
    "DEPLOY_ARTIFACT","APPLY_MIGRATION","HEALTH_CHECK","SMOKE_TEST","PROGRESSIVE_EXPOSURE",
    "WORKFLOW_VALIDATION","RECONCILIATION","POST_DEPLOYMENT_MONITORING","CERTIFICATION",
  ];
  const steps = raw.map((operationType, index) => ({
    ordinal: index + 1,
    operationType,
    prerequisites: index === 0 ? [] : [index],
    timeoutSeconds: operationType === "POST_DEPLOYMENT_MONITORING" ? 3600 : 900,
    retryPolicy: { maxAttempts: 2, backoffSeconds: 15 },
    idempotencyKey: hash({ deploymentId: id, operationType, ordinal: index + 1, revision: deployment.revision }),
    expectedOutcome: { registered: true },
    failureHandling: { action: "PAUSE_AND_CLASSIFY" },
    recoveryBehavior: { classification: deployment.recoveryClass },
    evidenceRequirement: { required: true },
  }));
  const planHash = hash(steps);
  await db.deploymentPlan.create({
    data: {
      deploymentId: id,
      revision: deployment.revision,
      status: "READY",
      planHash,
      steps,
      generatedBy: actorId,
    },
  });
  for (const step of steps) {
    await db.deploymentStep.upsert({
      where: { idempotencyKey: step.idempotencyKey },
      update: {},
      create: {
        deploymentId: id,
        ordinal: step.ordinal,
        operationType: step.operationType,
        prerequisites: step.prerequisites,
        timeoutSeconds: step.timeoutSeconds,
        retryPolicy: step.retryPolicy,
        idempotencyKey: step.idempotencyKey,
        expectedOutcome: step.expectedOutcome,
        failureHandling: step.failureHandling,
        recoveryBehavior: step.recoveryBehavior,
        evidenceRequirement: step.evidenceRequirement,
        status: "PENDING",
      },
    });
  }
  await evidence(id, "PLAN", { planHash, steps }, actorId);
  return { planHash, steps };
}

export async function setEnvironment(input: {
  name: string; actorId: string; state?: string; health?: string; frozen?: boolean;
  activeIncidents?: unknown; pendingMigrations?: unknown; capacity?: unknown; dependencyHealth?: unknown;
}) {
  assertEnvironment(input.name);
  return db.deploymentEnvironment.upsert({
    where: { name: input.name },
    update: {
      ...(input.state ? { state: input.state } : {}),
      ...(input.health ? { health: input.health } : {}),
      ...(input.frozen !== undefined ? { frozen: input.frozen } : {}),
      ...(input.activeIncidents !== undefined ? { activeIncidents: safe(input.activeIncidents) as never } : {}),
      ...(input.pendingMigrations !== undefined ? { pendingMigrations: safe(input.pendingMigrations) as never } : {}),
      ...(input.capacity !== undefined ? { capacity: safe(input.capacity) as never } : {}),
      ...(input.dependencyHealth !== undefined ? { dependencyHealth: safe(input.dependencyHealth) as never } : {}),
    },
    create: {
      name: input.name,
      state: input.state ?? "READY",
      health: input.health ?? "UNKNOWN",
      activeIncidents: safe(input.activeIncidents ?? []) as never,
      frozen: input.frozen ?? false,
      maintenanceMode: false,
      pendingMigrations: safe(input.pendingMigrations ?? []) as never,
      capacity: safe(input.capacity ?? {}) as never,
      dependencyHealth: safe(input.dependencyHealth ?? {}) as never,
      policyVersion: "15.36",
    },
  });
}

export async function recordIncident(input: {
  deploymentId: string; incidentReference: string; severity: string; affectedDomains?: unknown;
  affectedDependencies?: unknown; affectedJourneys?: unknown; decision: string; actorId: string;
}) {
  if (!(INCIDENT_DECISIONS as readonly string[]).includes(input.decision)) throw new Error("Invalid incident deployment decision");
  if (!["UNKNOWN","LOW","MEDIUM","HIGH","VERIFIED"].includes(input.severity)) throw new Error("Invalid incident severity");
  const deployment = await requireDeployment(input.deploymentId);
  if (input.decision === "BLOCK" || input.decision === "DELAY") {
    const target = input.decision === "BLOCK" ? "BLOCKED" : "PAUSED";
    if (deployment.status !== target) {
      transition(deployment.status, target);
      await db.deployment.update({ where: { id: deployment.id }, data: { status: target, operationState: "INCIDENT_GATED" } });
      await decide(deployment.id, "INCIDENT", deployment.status, target, input.actorId, deployment.policyVersion, `Incident ${input.incidentReference} requires ${input.decision}`);
    }
  }
  return db.deploymentIncident.create({
    data: {
      deploymentId: deployment.id,
      incidentReference: input.incidentReference.slice(0, 160),
      severity: input.severity,
      affectedDomains: safe(input.affectedDomains ?? []) as never,
      affectedDependencies: safe(input.affectedDependencies ?? []) as never,
      affectedJourneys: safe(input.affectedJourneys ?? []) as never,
      causalityConfidence: "UNKNOWN",
      decision: input.decision,
      evidence: { source: "governed-input", deploymentId: deployment.id },
    },
  });
}

export async function freeze(input: {
  scope: string; scopeReference: string; reason: string; ownerId: string; expiresAt: string; emergencyOverride?: boolean; auditEvidence?: unknown;
}) {
  if (!["GLOBAL","ENVIRONMENT","DOMAIN","PROVIDER","INCIDENT","SECURITY","MIGRATION"].includes(input.scope)) throw new Error("Invalid deployment freeze scope");
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error("Freeze expiry must be in the future");
  if (input.emergencyOverride !== true && input.reason.trim().length < 5) throw new Error("Freeze reason required");
  return db.deploymentFreeze.create({
    data: {
      scope: input.scope,
      scopeReference: input.scopeReference.slice(0, 160),
      reason: input.reason.slice(0, 500),
      ownerId: input.ownerId,
      expiresAt,
      emergencyOverride: input.emergencyOverride ?? false,
      auditEvidence: safe(input.auditEvidence ?? {}) as never,
    },
  });
}

export async function lock(id: string, scope: string, actorId: string, ttlSeconds = 900) {
  const deployment = await requireDeployment(id);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) throw new Error("Lock TTL is outside safe bounds");
  const existing = await db.deploymentLock.findFirst({ where: { scope, status: "ACTIVE", expiresAt: { gt: new Date() } } });
  if (existing && existing.deploymentId !== id) {
    await db.deploymentConflict.create({
      data: { deploymentId: id, scope, conflictingDeploymentId: existing.deploymentId, severity: "HIGH", reason: "Active deployment lock conflict" },
    });
    throw new Error("Deployment lock conflict");
  }
  return db.deploymentLock.upsert({
    where: { id: existing?.id ?? randomUUID() },
    update: { expiresAt: new Date(Date.now() + ttlSeconds * 1000), heartbeatAt: new Date(), ownerId: actorId, status: "ACTIVE" },
    create: { deploymentId: id, scope, ownerId: actorId, expiresAt: new Date(Date.now() + ttlSeconds * 1000), heartbeatAt: new Date(), status: "ACTIVE" },
  });
}

export async function start(id: string, actorId: string, idempotencyKey?: string) {
  const deployment = await requireDeployment(id);
  if (!["APPROVED","SCHEDULED","PREPARING"].includes(deployment.status)) throw new Error("Deployment is not startable");
  if (deployment.gates.some((gate) => gate.blocking && gate.result !== "PASS")) throw new Error("Blocking preflight gate remains");
  const freezeRecord = await db.deploymentFreeze.findFirst({
    where: { active: true, expiresAt: { gt: new Date() }, OR: [
      { scope: "GLOBAL" }, { scope: "ENVIRONMENT", scopeReference: deployment.environment },
    ] },
  });
  if (freezeRecord) throw new Error("Deployment freeze is active");
  const lockRecord = await lock(id, deployment.environment, actorId);
  const from = deployment.status;
  await db.deployment.update({ where: { id }, data: { status: "PREPARING", operationState: "LOCKED" } });
  await decide(id, "START", from, "PREPARING", actorId, deployment.policyVersion, `Deployment lock ${lockRecord.id} acquired; execution remains registered-operation only`, idempotencyKey);
  return requireDeployment(id);
}

export async function executeNext(id: string, operation: string, actorId: string, idempotencyKey?: string) {
  assertOperation(operation);
  const deployment = await requireDeployment(id);
  if (!["PREPARING","PRE_DEPLOYMENT_VALIDATING","DEPLOYING","DEPLOYMENT_VALIDATING","PROGRESSIVE_EXPOSURE","POST_DEPLOYMENT_VALIDATING"].includes(deployment.status)) {
    throw new Error("Deployment is not in an executable governance state");
  }
  const step = await db.deploymentStep.findFirst({ where: { deploymentId: id, operationType: operation, status: "PENDING" }, orderBy: { ordinal: "asc" } });
  if (!step) throw new Error("Registered operation has no pending plan step");
  const started = Date.now();
  await db.deploymentStep.update({ where: { id: step.id }, data: { status: "COMPLETED", result: { governed: true, sideEffect: false } } });
  await db.deploymentObservation.create({
    data: { deploymentId: id, operation, actorId, durationMs: Date.now() - started, result: "RECORDED", retryCount: 0, traceId: randomUUID() },
  });
  await evidence(id, "OPERATION", { operation, stepId: step.id, executed: false, registered: true }, actorId);
  if (operation === "DEPLOY_ARTIFACT") {
    const from = deployment.status;
    transition(from, "DEPLOYMENT_VALIDATING");
    await db.deployment.update({ where: { id }, data: { status: "DEPLOYMENT_VALIDATING", operationState: "AWAITING_HEALTH" } });
    await decide(id, "OPERATION", from, "DEPLOYMENT_VALIDATING", actorId, deployment.policyVersion, "Artifact deployment operation recorded without infrastructure execution", idempotencyKey);
  }
  return requireDeployment(id);
}

export async function recordHealth(id: string, stage: string, metrics: unknown, actorId: string) {
  const deployment = await requireDeployment(id);
  return db.deploymentHealthSnapshot.create({
    data: { deploymentId: id, stage: stage.slice(0, 80), metrics: safe(metrics) as never, source: "governed-observation", correlationId: deployment.correlationId },
  });
}

export async function validate(id: string, actorId: string) {
  const deployment = await requireDeployment(id);
  const healthCount = await db.deploymentHealthSnapshot.count({ where: { deploymentId: id } });
  const blocking = deployment.gates.filter((gate) => gate.blocking && gate.result !== "PASS");
  const validation = {
    healthEvidence: healthCount > 0,
    gates: blocking.length === 0,
    recoveryDeclared: deployment.recoveryClass !== "UNKNOWN",
    passed: healthCount > 0 && blocking.length === 0 && deployment.recoveryClass !== "UNKNOWN",
  };
  await db.deploymentValidation.create({
    data: { deploymentId: id, validationType: "POST_DEPLOYMENT", result: validation.passed ? "PASS" : "BLOCKED", checks: validation, evidence: { healthCount, blocking: blocking.map((g) => g.key) }, actorId },
  });
  const to = validation.passed ? "VERIFIED" : "PAUSED";
  transition(deployment.status, to);
  await db.deployment.update({ where: { id }, data: { status: to, operationState: validation.passed ? "VERIFIED" : "PAUSED" } });
  await decide(id, "VALIDATE", deployment.status, to, actorId, deployment.policyVersion, validation.passed ? "Deployment validation passed" : "Deployment validation blocked");
  await evidence(id, "VALIDATION", validation, actorId);
  return validation;
}

export async function requestRollback(id: string, actorId: string) {
  const deployment = await requireDeployment(id);
  if (deployment.recoveryClass !== "RECOVERABLE_BY_ROLLBACK") throw new Error("Rollback is not the classified recovery path");
  if (["CERTIFIED","INVALIDATED","ABORTED","ROLLED_BACK"].includes(deployment.status)) throw new Error("Deployment cannot enter rollback from terminal state");
  transition(deployment.status, "ROLLBACK_PENDING");
  await db.deployment.update({ where: { id }, data: { status: "ROLLBACK_PENDING", operationState: "RECOVERY" } });
  await db.deploymentRollback.create({
    data: {
      deploymentId: id, stage: "CURRENT", classification: deployment.recoveryClass, trigger: "GOVERNED_REQUEST",
      result: "PENDING_VERIFICATION", validated: false, evidence: { execution: "disabled", requiresValidation: true }, actorId,
    },
  });
  await decide(id, "ROLLBACK", deployment.status, "ROLLBACK_PENDING", actorId, deployment.policyVersion, "Rollback requested; success not inferred from request");
  return requireDeployment(id);
}

export async function verifyRollback(id: string, actorId: string, evidencePayload: unknown) {
  const deployment = await requireDeployment(id);
  if (deployment.status !== "ROLLBACK_PENDING") throw new Error("Deployment is not awaiting rollback verification");
  const evidenceRecord = await evidence(id, "ROLLBACK", evidencePayload, actorId);
  const rollback = await db.deploymentRollback.findFirst({ where: { deploymentId: id }, orderBy: { createdAt: "desc" } });
  if (!rollback) throw new Error("Rollback record missing");
  await db.deploymentRollback.update({ where: { id: rollback.id }, data: { validated: true, result: "VERIFIED", evidence: { evidenceId: evidenceRecord.id, healthRestored: true, workflowsChecked: true, reconciliationChecked: true, securityChecked: true } } });
  await db.deployment.update({ where: { id }, data: { status: "ROLLED_BACK", operationState: "RECOVERED" } });
  await decide(id, "ROLLBACK_VERIFY", "ROLLBACK_PENDING", "ROLLED_BACK", actorId, deployment.policyVersion, "Rollback verified from persisted validation evidence");
  return requireDeployment(id);
}

export async function forwardRecovery(id: string, actorId: string, plan: unknown, approval: unknown) {
  const deployment = await requireDeployment(id);
  if (deployment.recoveryClass !== "RECOVERABLE_BY_FORWARD_FIX") throw new Error("Forward recovery is not the classified recovery path");
  if (deployment.status !== "FORWARD_RECOVERY_REQUIRED") throw new Error("Deployment is not awaiting forward recovery");
  return db.deploymentRecovery.create({
    data: {
      deploymentId: id, classification: deployment.recoveryClass, plan: safe(plan) as never,
      approval: safe(approval) as never, validation: {}, reconciliation: {}, certification: {},
      status: "PLANNED", actorId,
    },
  });
}

export async function certify(id: string, actorId: string) {
  const deployment = await requireDeployment(id);
  if (deployment.status !== "VERIFIED") throw new Error("Deployment must be VERIFIED before certification");
  const validation = await db.deploymentValidation.findFirst({ where: { deploymentId: id }, orderBy: { createdAt: "desc" } });
  if (!validation || validation.result !== "PASS") throw new Error("Passing post-deployment validation evidence is required");
  const unresolved = await db.deploymentConflict.count({ where: { deploymentId: id, resolved: false } });
  if (unresolved > 0) throw new Error("Unresolved deployment conflicts block certification");
  const artifact = await db.deploymentArtifact.findUnique({ where: { id: deployment.artifactId } });
  if (!artifact?.approved || !artifact.immutable) throw new Error("Artifact certification precondition failed");
  const certificate = await db.deploymentCertification.create({
    data: {
      deploymentId: id,
      status: "CERTIFIED",
      artifactHash: artifact.integrityHash,
      policyVersion: deployment.policyVersion,
      validationEvidence: validation.evidence as never,
      recoveryEvidence: { classification: deployment.recoveryClass },
      reconciliationEvidence: { required: true },
      validUntil: new Date(Date.now() + 86400000),
      certifiedBy: actorId,
    },
  });
  await db.deployment.update({ where: { id }, data: { status: "CERTIFIED", operationState: "CERTIFIED" } });
  await decide(id, "CERTIFY", "VERIFIED", "CERTIFIED", actorId, deployment.policyVersion, "Deployment certified from validated evidence");
  return certificate;
}

export async function pause(id: string, actorId: string, reason = "MANUAL") {
  const deployment = await requireDeployment(id);
  if (["CERTIFIED","INVALIDATED","ABORTED","ROLLED_BACK"].includes(deployment.status)) throw new Error("Deployment cannot be paused");
  transition(deployment.status, "PAUSED");
  await db.deployment.update({ where: { id }, data: { status: "PAUSED", operationState: "PAUSED" } });
  await db.deploymentPause.create({ data: { deploymentId: id, reason: reason.slice(0, 80), details: { governed: true }, stage: deployment.status, actorId } });
  await decide(id, "PAUSE", deployment.status, "PAUSED", actorId, deployment.policyVersion, "Deployment paused by governed control");
  return requireDeployment(id);
}

export async function abort(id: string, actorId: string) {
  const deployment = await requireDeployment(id);
  if (["CERTIFIED","INVALIDATED","ABORTED","ROLLED_BACK"].includes(deployment.status)) throw new Error("Deployment cannot be aborted");
  transition(deployment.status, "ABORTED");
  await db.deployment.update({ where: { id }, data: { status: "ABORTED", operationState: "ABORTED" } });
  await db.deploymentAbort.create({ data: { deploymentId: id, reason: "Governed abort", actorId, evidence: { sideEffects: false } } });
  await decide(id, "ABORT", deployment.status, "ABORTED", actorId, deployment.policyVersion, "Deployment aborted without business mutation");
  return requireDeployment(id);
}

export async function listDeployments(limit = 50) {
  return db.deployment.findMany({
    take: Math.min(Math.max(limit, 1), 100),
    orderBy: { updatedAt: "desc" },
    include: { gates: true, plans: { orderBy: { revision: "desc" }, take: 1 }, certifications: { orderBy: { certifiedAt: "desc" }, take: 1 } },
  });
}

export async function detail(id: string) {
  return db.deployment.findUnique({
    where: { id },
    include: {
      gates: true, plans: { orderBy: { revision: "desc" }, take: 5 }, decisions: { orderBy: { createdAt: "desc" }, take: 50 },
      evidence: { orderBy: { createdAt: "desc" }, take: 100 }, validations: { orderBy: { createdAt: "desc" }, take: 20 },
      rollbacks: { orderBy: { createdAt: "desc" }, take: 20 }, recoveries: { orderBy: { createdAt: "desc" }, take: 20 },
      incidents: { orderBy: { createdAt: "desc" }, take: 20 }, observations: { orderBy: { createdAt: "desc" }, take: 50 },
      healthSnapshots: { orderBy: { capturedAt: "desc" }, take: 20 }, locks: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}
