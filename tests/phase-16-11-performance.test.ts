import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Phase 16.11 registers certification and controlled benchmark commands", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.scripts["production-certification:phase-16-11"], "tsx scripts/phase-16-11-performance-certification.ts");
  assert.equal(pkg.scripts["performance:benchmark:phase-16-11"], "tsx scripts/phase-16-11-runtime-benchmark.ts");
});

test("Phase 16.11 performance certification refuses fabricated runtime evidence", async () => {
  const source = await readFile("scripts/phase-16-11-performance-certification.ts", "utf8");
  assert.match(source, /PERF_BASE_URL/);
  assert.match(source, /UNAVAILABLE/);
  assert.match(source, /do not fabricate|not fabricated/i);
  assert.match(source, /artifacts\/phase-16-11-performance-evidence\.json/);
});

test("Phase 16.11 runtime benchmark is isolated to safe application endpoints", async () => {
  const source = await readFile("scripts/phase-16-11-runtime-benchmark.ts", "utf8");
  assert.match(source, /\/api\/health/);
  assert.match(source, /\/api\/ready/);
  assert.match(source, /\/api\/readiness/);
  assert.match(source, /"\/"\]/);
  assert.doesNotMatch(source, /qikink/i);
  assert.doesNotMatch(source, /payment.*mutation|create.*payment/i);
});

test("Phase 16.11 keeps load testing out of production", async () => {
  const source = await readFile("scripts/phase-16-11-runtime-benchmark.ts", "utf8");
  assert.match(source, /productionTraffic:false/);
  assert.match(source, /isolated CI PostgreSQL \+ local Next\.js production server/);
});
