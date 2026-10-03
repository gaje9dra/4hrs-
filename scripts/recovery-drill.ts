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
  try {
    run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath, cliDatabaseUrl(source)]);
    const checksum = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");
    console.log(`[PASS] backup artifact created; sha256=${checksum}`);

    const admin = new URL(adminUrl);
    admin.pathname = "/postgres";
    admin.searchParams.delete("schema");
    run("psql", [admin.toString(), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${targetName}"`]);
    run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", target, dumpPath]);

    process.env.DATABASE_URL = target;
    process.env.DIRECT_URL = target;
    const checks = await validateRestoredDatabase();
    for (const check of checks) console.log(`[${check.ok ? "PASS" : "FAIL"}] restored:${check.name}: ${check.detail}`);
    assertRecoveryChecks(checks);
    console.log("[PASS] non-production database backup/restore validation drill completed.");
  } finally {
    const admin = new URL(adminUrl);
    admin.pathname = "/postgres";
    admin.searchParams.delete("schema");
    try { run("psql", [admin.toString(), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${targetName}"`]); } catch {}
    rmSync(tempDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Recovery drill failed."); process.exitCode = 1; });
