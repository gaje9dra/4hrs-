import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

type Finding = Readonly<{
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  affectedComponent: string;
  scenario: string;
  impact: string;
  evidence: string;
  remediation: string;
  remainingRisk: string;
}>;

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const requireText = (label: string, text: string, tokens: readonly string[]) => {
  const missing = tokens.filter((token) => !text.includes(token));
  if (missing.length) throw new Error(`Phase 16.17 evidence missing for ${label}: ${missing.join(", ")}`);
};

async function main(): Promise<void> {
  const files = {
    recoveryDrill: read("scripts/recovery-drill.ts"),
    recoveryValidate: read("scripts/recovery-validate.ts"),
    restoreValidation: read("lib/recovery/restore-validation.ts"),
    integrity: read("lib/recovery/integrity.ts"),
    repair: read("lib/recovery/repair.ts"),
    runbook: read("docs/recovery-runbook.md"),
    phase15: read("docs/phase-15-5-backup-disaster-recovery.md"),
    phase18: read("docs/phase-15-18-business-continuity-disaster-recovery-validation.md"),
    netlify: read("netlify.toml"),
    ci: read(".github/workflows/ci.yml"),
  };

  requireText("non-production recovery drill", files.recoveryDrill, [
    'NODE_ENV === "production"',
    "pg_dump",
    "pg_restore",
    "CREATE DATABASE",
    "DROP DATABASE IF EXISTS",
    "randomUUID",
  ]);
  requireText("restore validation", files.restoreValidation, [
    "_prisma_migrations",
    "information_schema.tables",
    "information_schema.table_constraints",
    "assertRecoveryChecks",
  ]);
  requireText("domain integrity", files.integrity, [
    "PAYMENT_AMOUNT_MISMATCH",
    "REFUND_TOTAL_EXCEEDS_PAYMENT",
    "FULFILLMENT_QUANTITY_INVALID",
    "ORPHAN_RECORDS",
  ]);
  requireText("safe repair", files.repair, [
    "idempotencyKey",
    "shipping.recovery",
    "recordAdminAudit",
  ]);
  requireText("recovery documentation", files.phase15, [
    "managed PostgreSQL backups",
    "No fixed RPO/RTO guarantee",
    "Qikink",
    "Provider systems are reconciliation sources",
  ]);
  requireText("business continuity documentation", files.phase18, [
    "RPO",
    "RTO",
    "restore",
    "reconciliation",
  ]);
  requireText("Netlify recovery boundary", files.netlify, [
    "npm run build",
    "NODE_VERSION = \"24.21.0\"",
    "NPM_VERSION = \"11.6.0\"",
  ]);
  requireText("CI recovery drill", files.ci, [
    "recovery-drill:",
    "npm run recovery:drill",
  ]);

  if (/prisma migrate reset|prisma db push/i.test(files.recoveryDrill + files.runbook)) {
    throw new Error("Phase 16.17 recovery controls contain a prohibited destructive Prisma recovery command.");
  }

  const findings: Finding[] = [
    {
      severity: "INFORMATIONAL",
      affectedComponent: "Managed PostgreSQL backup/PITR",
      scenario: "Production database loss requiring provider-managed backup or point-in-time recovery",
      impact: "The repository cannot prove the production provider's backup cadence, retention, immutability, or PITR window.",
      evidence: "Phase 15.5 explicitly assigns managed PostgreSQL backups/PITR to the production database operator; no provider credentials or backup endpoint are present in the repository.",
      remediation: "Record provider-specific backup/PITR evidence and perform an authorized restore verification outside the application repository.",
      remainingRisk: "Production recovery-point availability remains dependent on the selected database provider and operator controls.",
    },
    {
      severity: "INFORMATIONAL",
      affectedComponent: "Netlify deployment/configuration",
      scenario: "Hosting configuration loss or bad deployment",
      impact: "The repository can prove build configuration and deployment compatibility but cannot prove account-level deploy history, environment-variable retention, or rollback access.",
      evidence: "netlify.toml defines the build/functions/runtime boundary; Netlify account state is external.",
      remediation: "Maintain documented operator access to Netlify deploy history, rollback and environment configuration.",
      remainingRisk: "Hosting recovery depends on external Netlify account controls.",
    },
    {
      severity: "INFORMATIONAL",
      affectedComponent: "External media/object storage",
      scenario: "Database restores successfully but referenced media objects are unavailable",
      impact: "Catalog records may recover while external media remains unavailable.",
      evidence: "Repository stores media references but does not implement an object-storage backup service.",
      remediation: "Verify provider-side object backup/versioning and access policy as an operational dependency.",
      remainingRisk: "Media recoverability depends on the external storage provider.",
    },
  ];

  const recoveryDrillEvidencePath = join(root, "artifacts/phase-16-17-recovery-drill-evidence.json");
  const restoreDrillPassed = existsSync(recoveryDrillEvidencePath)
    ? JSON.parse(readFileSync(recoveryDrillEvidencePath, "utf8")).status === "PASS"
    : false;

  const critical = findings.filter((x) => x.severity === "CRITICAL").length;
  const high = findings.filter((x) => x.severity === "HIGH").length;
  const medium = findings.filter((x) => x.severity === "MEDIUM").length;
  const low = findings.filter((x) => x.severity === "LOW").length;
  const status = critical === 0 && high === 0 && medium === 0 && restoreDrillPassed
    ? "READY FOR PHASE 16.18"
    : restoreDrillPassed ? "NOT READY FOR PHASE 16.18" : "BLOCKED";

  mkdirSync(join(root, "artifacts"), { recursive: true });
  writeFileSync(
    join(root, "artifacts/phase-16-17-backup-disaster-recovery-certification-evidence.json"),
    JSON.stringify({
      phase: "16.17",
      status,
      generatedAt: new Date().toISOString(),
      findings,
      counts: { critical, high, medium, low, informational: findings.filter((x) => x.severity === "INFORMATIONAL").length },
      restoreDrill: { passed: restoreDrillPassed, evidencePath: "artifacts/phase-16-17-recovery-drill-evidence.json" },
      rpo: "Production RPO is not fixed by repository code; CI drill demonstrates a restorable database dump with a measured exercise boundary only.",
      rto: "Production RTO is not guaranteed by repository code; CI drill records measured restore/validation duration for the isolated test database.",
      productionEvidenceBoundary: "Provider-managed backup/PITR, Netlify account recovery, and external media recovery require operator/provider evidence.",
    }, null, 2) + "\n",
  );

  console.log(JSON.stringify({ phase: "16.17", status, critical, high, medium, low, restoreDrillPassed }));
  if (status === "BLOCKED") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Phase 16.17 certification failed.");
  process.exitCode = 1;
});
