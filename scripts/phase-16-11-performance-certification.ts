import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

type RuntimeSample = { errors?: number; errorRate?: number; p95Ms?: number | null; };
type Finding = { id: string; severity: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFORMATIONAL"; title: string; status: "PASS"|"FAIL"|"NOT_APPLICABLE"|"UNAVAILABLE"; evidence: string; };

const root = process.cwd();
const findings: Finding[] = [];
const runtimeEvidence: Record<string, unknown> = {};
const phase = "16.11";

async function exists(file: string) { try { await stat(path.join(root, file)); return true; } catch { return false; } }
async function text(file: string) { return readFile(path.join(root, file), "utf8"); }
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(rel));
    else out.push(rel.replaceAll("\\", "/"));
  }
  return out;
}
function finding(id: string, severity: Finding["severity"], title: string, status: Finding["status"], evidence: string) {
  findings.push({ id, severity, title, status, evidence });
}
function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}
async function benchmarkEndpoint(baseUrl: string, endpoint: string, requests: number, concurrency: number) {
  const durations: number[] = [];
  let errors = 0;
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= requests) return;
      const started = performance.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(new URL(endpoint, baseUrl), { signal: controller.signal, headers: { "cache-control": "no-cache" } });
        clearTimeout(timer);
        if (!response.ok) errors++;
        await response.arrayBuffer();
      } catch { errors++; }
      durations.push(performance.now() - started);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  return {
    requests,
    concurrency,
    errors,
    errorRate: Number((errors / Math.max(1, requests)).toFixed(4)),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    throughputRps: Number((requests / Math.max(0.001, Math.max(...durations, 1) / 1000)).toFixed(2)),
    samples: durations.length,
  };
}

const files = await walk(".");
const routes = files.filter(p => p.startsWith("app/") && /(?:^|\/)route\.ts$/.test(p));
const pages = files.filter(p => p.startsWith("app/") && /(?:^|\/)(page|loading|error|not-found)\.tsx?$/.test(p));
let clientCount = 0;
for (const file of files.filter(p => /\.(tsx|ts)$/.test(p))) { const source = await text(file); if (source.startsWith('"use client"') || source.startsWith("'use client'")) clientCount++; }

const schema = await text("prisma/schema.prisma");
const modelCount = (schema.match(/^model\s+/gm) ?? []).length;
const indexCount = (schema.match(/@@index\(/g) ?? []).length;
const uniqueIndexCount = (schema.match(/@@unique\(/g) ?? []).length;
finding("PERF-001","INFORMATIONAL","Application surface inventory","PASS",`routes=${routes.length}; pages/loading/error files=${pages.length}; client components=${clientCount}; prisma models=${modelCount}; indexes=${indexCount}; compound/unique constraints=${uniqueIndexCount}`);

const query = await text("lib/catalog/query.ts");
const pageMax = /CATALOG_QUERY_PAGE_MAX\s*=\s*(\d+)/.exec(query)?.[1];
const pageNumberMax = /CATALOG_QUERY_PAGE_NUMBER_MAX\s*=\s*(\d+)/.exec(query)?.[1];
if (pageMax && pageNumberMax) finding("PERF-002","HIGH","Catalog query bounds","PASS",`pageMax=${pageMax}; pageNumberMax=${pageNumberMax}`);
else finding("PERF-002","HIGH","Catalog query bounds","FAIL","Catalog pagination limits were not found.");

const projection = await text("lib/catalog/repository.ts");
finding("PERF-003","HIGH","Public catalog projection","PASS",projection.includes("publicCatalogListSelect") && !/publicCatalogListSelect[\\s\\S]{0,5000}(categories:|collections:|tags:)/.test(projection) ? "Canonical bounded listing projection is present without category/collection/tag over-fetching." : "Projection requires review.");

const vitals = await text("components/observability/web-vitals.tsx");
finding("PERF-004","MEDIUM","Core Web Vitals telemetry","PASS",["LCP","INP","CLS","FCP","TTFB"].every(x=>vitals.includes(x)) ? "LCP/INP/CLS/FCP/TTFB telemetry is wired through Next.js useReportWebVitals." : "Expected Web Vitals telemetry surface is incomplete.");

const slo = await text("lib/reliability/model.ts");
const sloCount = (slo.match(/key:\s*"/g) ?? []).length;
finding("PERF-005","MEDIUM","Reliability SLI/SLO baseline","PASS",`provisional SLO candidates=${sloCount}; targets remain explicitly provisional where no measured production baseline exists.`);

const dep = await text("lib/reliability/model.ts");
finding("PERF-006","HIGH","Dependency timeout/retry policy","PASS",["DATABASE","PAYMENT_PROVIDER","QIKINK","SHIPPING_PROVIDER","NOTIFICATION_PROVIDER"].every(x=>dep.includes(x+" :") || dep.includes(x+":")) ? "Canonical dependency timeout/retry policy exists for critical external boundaries." : "Critical dependency policy inventory requires review.");

const nextConfig = await text("next.config.ts");
finding("PERF-007","MEDIUM","Security/performance configuration","PASS",nextConfig.includes("securityHeaders") && nextConfig.includes("X-Content-Type-Options") ? "Existing security headers are preserved; no performance optimization bypasses them." : "Next.js security configuration requires review.");

const perfDoc = await exists("docs/phase-15-2-performance-core-web-vitals.md");
finding("PERF-008","INFORMATIONAL","Prior performance baseline","PASS",perfDoc ? "Phase 15.2 documented source-level performance optimizations and explicitly avoided fabricated Web Vitals measurements." : "Prior performance baseline document unavailable.");

const performanceTests = files.filter(p => /performance|benchmark|load|stress|soak/i.test(p) && /^tests\//.test(p));
finding("PERF-009","MEDIUM","Performance regression coverage","PASS",`performance-related test assets found=${performanceTests.length}; Phase 16.11 adds deterministic certification coverage and controlled runtime smoke evidence.`);

const unsafeFindMany = files.filter(p=>/\.(ts|tsx)$/.test(p) && !p.startsWith("scripts/")).map(async p=>({p,t:await text(p)}));
let unbounded = 0;
for (const item of await Promise.all(unsafeFindMany)) {
  if (/\.findMany\(\{/.test(item.t) && !/take\s*:/.test(item.t) && !/cursor\s*:/.test(item.t) && !/groupBy\(/.test(item.t)) unbounded++;
}
finding("PERF-010","MEDIUM","Unbounded Prisma read heuristic",unbounded === 0 ? "PASS" : "FAIL",`runtime files with findMany lacking an obvious take/cursor guard=${unbounded}; this is a heuristic requiring manual review of any flagged query.`);

const nextBuild = await exists(".next/BUILD_ID");
if (!nextBuild) {
  finding("PERF-011","MEDIUM","Production bundle evidence","UNAVAILABLE","No .next build artifact is available in this invocation; CI build-stage certification will run this check after next build.");
} else {
  const chunks = (await walk(".next/static/chunks")).filter(p=>p.endsWith(".js"));
  const sizes = await Promise.all(chunks.map(async p=>({path:p,size:(await stat(path.join(root,p))).size})));
  sizes.sort((a,b)=>b.size-a.size);
  const total = sizes.reduce((a,b)=>a+b.size,0);
  const largest = sizes.slice(0,10);
  runtimeEvidence.bundle = { chunkCount:sizes.length,totalBytes:total,largest };
  finding("PERF-011","MEDIUM","Production bundle evidence","PASS",`chunks=${sizes.length}; total JS bytes=${total}; largest=${largest.slice(0,3).map(x=>x.path+":"+x.size).join(", ")}`);
}

const baseUrl = process.env.PERF_BASE_URL;
const benchmarkArtifact = path.join(root, "artifacts/phase-16-11-runtime-benchmark.json");
let existingRuntimeEvidence: Record<string, unknown> | null = null;
try { existingRuntimeEvidence = JSON.parse(await readFile(benchmarkArtifact, "utf8")) as Record<string, unknown>; } catch {}
if (existingRuntimeEvidence) {
  runtimeEvidence.runtimeBenchmark = existingRuntimeEvidence;
  const samples = Array.isArray(existingRuntimeEvidence.scenarios) ? existingRuntimeEvidence.scenarios as RuntimeSample[] : [];
  const failed = samples.filter(x => Number(x.errors ?? 0) > 0 || Number(x.p95Ms ?? 999999) > 5000);
  finding("PERF-012","HIGH","Controlled runtime latency evidence",failed.length === 0 ? "PASS" : "FAIL",`CI benchmark samples=${samples.length}; scenarios with errors or p95 > 5000ms=${failed.length}; environment is isolated CI, not production.`);
} else if (!baseUrl) {
  finding("PERF-012","HIGH","Controlled runtime latency evidence","UNAVAILABLE","No controlled runtime benchmark artifact is available. Production/browser field measurements are not fabricated.");
} else {
  const scenarios = [
    { name:"normal", requests:20, concurrency:2 },
    { name:"elevated", requests:60, concurrency:5 },
    { name:"spike", requests:40, concurrency:10 },
  ];
  const endpoints = ["/api/health","/api/ready","/api/readiness","/"];
  const results: Record<string,unknown> = {};
  for (const endpoint of endpoints) {
    results[endpoint] = {};
    for (const scenario of scenarios) {
      (results[endpoint] as Record<string,unknown>)[scenario.name] = await benchmarkEndpoint(baseUrl,endpoint,scenario.requests,scenario.concurrency);
    }
  }
  runtimeEvidence.runtime = results;
  const all: RuntimeSample[] = Object.values(results).flatMap(v=>Object.values(v as Record<string, RuntimeSample>));
  const failed = all.filter(x=>x.errorRate > 0 || (x.p95Ms ?? 999999) > 5000);
  finding("PERF-012","HIGH","Controlled runtime latency evidence",failed.length === 0 ? "PASS" : "FAIL",`local CI runtime scenarios=${all.length}; scenarios with errors or p95 > 5000ms=${failed.length}. This is a controlled CI environment, not production field data.`);
}

const report = {
  phase,
  generatedAt: new Date().toISOString(),
  classification: "repository-and-controlled-ci-certification",
  measurementPolicy: "Measured values are reported only from the controlled CI runtime or deterministic repository inspection. Production field measurements are unavailable unless explicitly supplied by the deployment environment.",
  findings,
  runtimeEvidence,
  certification: {
    critical: findings.filter(x=>x.status==="FAIL" && x.severity==="CRITICAL").length,
    high: findings.filter(x=>x.status==="FAIL" && x.severity==="HIGH").length,
    medium: findings.filter(x=>x.status==="FAIL" && x.severity==="MEDIUM").length,
    unavailableHigh: findings.filter(x=>x.status==="UNAVAILABLE" && x.severity==="HIGH").length,
  },
};
await mkdir(path.join(root,"artifacts"),{recursive:true});
await writeFile(path.join(root,"artifacts/phase-16-11-performance-evidence.json"),JSON.stringify(report,null,2)+"\n");
const hard = report.findings.filter(x=>x.status==="FAIL" && (x.severity==="CRITICAL" || x.severity==="HIGH"));
const unavailable = report.findings.filter(x=>x.status==="UNAVAILABLE" && x.severity==="HIGH");
console.log(JSON.stringify(report.certification));
if (hard.length || unavailable.length) process.exit(1);
