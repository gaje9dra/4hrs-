import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("Phase 16.18 certification wiring and safety gates", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string,string> };
  const ci = read(".github/workflows/ci.yml");
  const script = read("scripts/phase-16-18-resilience-failure-injection-certification.ts");

  assert.match(pkg.scripts["production-certification:phase-16-18"] ?? "", /phase-16-18-resilience-failure-injection-certification/);
  assert.match(ci, /production-certification:phase-16-18/);
  assert.match(ci, /phase-16-18-resilience-failure-injection-evidence\.json/);
  assert.match(script, /READY FOR PHASE 16\.19/);
  assert.match(script, /Phase 16\.19 is not implemented/);
  assert.match(script, /createQikinkFulfillmentProvider/);
  assert.match(script, /classifyShippingRetry/);
  assert.match(script, /retryDelaySeconds/);
});

test("Phase 16.18 preserves the existing guarded resilience framework", () => {
  const experiments = read("lib/resilience/experiments.ts");
  const validator = read("scripts/resilience-validate.ts");

  assert.match(experiments, /PROHIBITED/);
  assert.match(experiments, /allowlisted/);
  assert.match(experiments, /SAFE_TERMINATION/);
  assert.match(experiments, /arbitrarySql/);
  assert.match(experiments, /arbitraryShell/);
  assert.match(validator, /DATABASE_RESILIENCE/);
  assert.match(validator, /DEPENDENCY_DEGRADATION/);
});
