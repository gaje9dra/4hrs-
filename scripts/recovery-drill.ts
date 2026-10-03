import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { validateRestoredDatabase, assertRecoveryChecks } from "@/lib/recovery/restore-validation";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the non-production recovery drill.`);
  return value;
}
function cliDatabaseUrl(base: string, name?: string): string {
  const url = new URL(base);
  if (name) url.pathname = `/${name}`;
  url.searchParams.delete("schema");
  return url.toString();
}
function databaseUrlWithName(base: string, name: string): string {
  return cliDatabaseUrl(base, name);
}
function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  execFileSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Recovery drill is prohibited in production.");
  const source = requiredEnv("DATABASE_URL");
  const url = new URL(source);
  const adminUrl = process.env.DIRECT_URL ?? source;
  const targetName = `recovery_drill_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const target = databaseUrlWithName(adminUrl, targetName);
  const tempDir = mkdtempSync(`${tmpdir()}/4hrs-recovery-`);
  const dumpPath = `${tempDir}/database.dump`;
  const startedAt = new Date();
  let backupCompletedAt: Date | undefined;
  let databaseAvailableAt: Date | undefined;
  let validationCompletedAt: Date | undefined;
  try {
    run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath, cliDatabaseUrl(source)]);
    backupCompletedAt = new Date();
    const checksum = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");
    console.log(`[PASS] backup artifact created; sha256=${checksum}`);
    console.log(`[RECOVERY] backup_timestamp=${backupCompletedAt.toISOString()}`);

    const admin = new URL(adminUrl);
    admin.pathname = "/postgres";
    admin.searchParams.delete("schema");
    run("psql", [admin.toString(), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${targetName}"`]);
    run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", target, dumpPath]);
    databaseAvailableAt = new Date();
    console.log(`[RECOVERY] database_available_timestamp=${databaseAvailableAt.toISOString()}`);

    process.env.DATABASE_URL = target;
    process.env.DIRECT_URL = target;
    const checks = await validateRestoredDatabase();
    for (const check of checks) console.log(`[${check.ok ? "PASS" : "FAIL"}] restored:${check.name}: ${check.detail}`);
    assertRecoveryChecks(checks);
    validationCompletedAt = new Date();
    const recoveryMs = validationCompletedAt.getTime() - startedAt.getTime();
    const restoreMs = databaseAvailableAt.getTime() - startedAt.getTime();
    const validationMs = validationCompletedAt.getTime() - databaseAvailableAt.getTime();
    console.log(`[RECOVERY] validation_completed_timestamp=${validationCompletedAt.toISOString()}`);
    console.log(JSON.stringify({
      recoveryExercise: "phase-15.18",
      environment: "non-production",
      backupTimestamp: backupCompletedAt?.toISOString(),
      databaseAvailableTimestamp: databaseAvailableAt?.toISOString(),
      validationCompletedTimestamp: validationCompletedAt.toISOString(),
      measuredRestoreSeconds: Number((restoreMs / 1000).toFixed(3)),
      measuredValidationSeconds: Number((validationMs / 1000).toFixed(3)),
      measuredRecoverySeconds: Number((recoveryMs / 1000).toFixed(3)),
      dataLossBoundary: "schema-only CI exercise; no production data loss measurement is claimed",
    }));
    console.log("[PASS] non-production database backup/restore validation drill completed.");
  } finally {
    const admin = new URL(adminUrl);
    admin.pathname = "/postgres";
    admin.searchParams.delete("schema");
    try {
      run("psql", [admin.toString(), "-v", "ON_ERROR_STOP=1", "-c", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${targetName}' AND pid <> pg_backend_pid()`]);
      run("psql", [admin.toString(), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${targetName}"`]);
    } catch (error) {
      console.error(`[WARN] recovery drill cleanup failed for temporary database "${targetName}"; manual cleanup may be required.`);
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Recovery drill failed."); process.exitCode = 1; });
