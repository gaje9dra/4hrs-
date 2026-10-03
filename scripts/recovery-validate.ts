import { assertRecoveryChecks, validateRestoredDatabase } from "@/lib/recovery/restore-validation";
import { runIntegrityAudit } from "@/lib/recovery/integrity";

async function main() {
  const checks = await validateRestoredDatabase();
  for (const check of checks) console.log(`[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`);
  const findings = await runIntegrityAudit();
  for (const item of findings) console.log(`[${item.severity}] ${item.code} ${item.resourceType}${item.resourceId ? `/${item.resourceId}` : ""}: ${item.message}`);
  assertRecoveryChecks(checks);
  const confirmed = findings.filter((item) => item.severity === "confirmed_violation");
  if (confirmed.length > 0) throw new Error(`Recovery integrity audit found ${confirmed.length} confirmed violation(s).`);
  console.log("Recovery validation completed without confirmed integrity violations.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Recovery validation failed."); process.exitCode = 1; });
