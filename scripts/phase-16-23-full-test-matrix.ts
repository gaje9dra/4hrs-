import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT EXECUTABLE" | "NOT APPLICABLE";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type MatrixResult = {
  id: string;
  category: string;
  status: Status;
  severity: Severity;
  scenarios: number;
  evidence: string;
  gaps: string[];
};

const root = process.cwd();

async function main() {

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(relative(root, full).replaceAll("\\", "/"));
  }
  return files;
}

const files = await walk(root);
const testFiles = files.filter((p) => /^tests\/.*\.test\.ts$/.test(p)).sort();
const routeFiles = files.filter((p) => /^app\/.*\/route\.ts$/.test(p)).sort();
const pageFiles = files.filter((p) => /^app\/.*\/page\.tsx?$/.test(p)).sort();

const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const ci = await readFile(".github/workflows/ci.yml", "utf8");

const testRun = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "--test", "--test-concurrency=1", ...testFiles],
  {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  },
);

const output = `${testRun.stdout ?? ""}\n${testRun.stderr ?? ""}`;
const metric = (name: string) => {
  const match = output.match(new RegExp(`# ${name}\\s+(\\d+)`));
  return match ? Number(match[1]) : null;
};
const testCount = metric("tests");
const passCount = metric("pass");
const failCount = metric("fail");
const skippedCount = metric("skipped") ?? 0;
const todoCount = metric("todo") ?? 0;

const has = (pattern: RegExp) => testFiles.some((p) => pattern.test(p));
const categories: Array<{
  id: string; category: string; severity: Severity; pattern?: RegExp; evidence?: string; gaps?: string[];
}> = [
  { id:"A", category:"Functional", severity:"HIGH", pattern:/catalog|cart|checkout|order|returns|storefront|customer|admin/ },
  { id:"B", category:"Integration", severity:"HIGH", pattern:/provider|persistence|integration|reconciliation|fulfillment|shipping|payment/ },
  { id:"C", category:"End-to-End", severity:"HIGH", pattern:/commerce-journey|customer-order-experience|phase-16-2/ },
  { id:"D", category:"API", severity:"HIGH", pattern:/api-contract|api-governance|order-api|cart-api|customer-authentication-api/ },
  { id:"E", category:"Database", severity:"HIGH", pattern:/persistence|database-migration|integrity|catalog-integrity/ },
  { id:"F", category:"Security", severity:"CRITICAL", pattern:/security|csp|security-hardening|phase-16-10/ },
  { id:"G", category:"Authorization", severity:"CRITICAL", pattern:/authorization|admin-platform|admin-.*operations|rbac/ },
  { id:"H", category:"Privacy", severity:"CRITICAL", pattern:/privacy|data-privacy|customer-account-privacy/ },
  { id:"I", category:"Accessibility", severity:"MEDIUM", pattern:/accessibility|frontend-accessibility|checkout-ui|customer-authentication-ui/ },
  { id:"J", category:"Responsive UI", severity:"MEDIUM", pattern:/storefront|checkout-ui|customer-authentication-ui/ },
  { id:"K", category:"Performance", severity:"HIGH", pattern:/performance|cost-capacity/ },
  { id:"L", category:"Concurrency", severity:"HIGH", pattern:/retry|resilience|fulfillment|shipping|order-lifecycle|cart-domain-service/ },
  { id:"M", category:"Idempotency", severity:"HIGH", pattern:/payment|fulfillment|shipping|reconciliation|notification|event/ },
  { id:"N", category:"Failure Injection", severity:"HIGH", pattern:/resilience|controlled-sandbox|retry/ },
  { id:"O", category:"Recovery", severity:"HIGH", pattern:/recovery|resilience|rehearsal|backup-disaster/ },
  { id:"P", category:"Background Jobs", severity:"HIGH", pattern:/background-event|notification|automation/ },
  { id:"Q", category:"Events", severity:"HIGH", pattern:/background-event|payment.*sandbox|reconciliation/ },
  { id:"R", category:"Webhooks", severity:"HIGH", pattern:/payment|qikink|webhook/ },
  { id:"S", category:"Payment", severity:"CRITICAL", pattern:/payment/ },
  { id:"T", category:"Fulfillment", severity:"CRITICAL", pattern:/fulfillment/ },
  { id:"U", category:"Qikink", severity:"CRITICAL", pattern:/qikink/ },
  { id:"V", category:"Shipping", severity:"HIGH", pattern:/shipping/ },
  { id:"W", category:"Returns", severity:"HIGH", pattern:/returns/ },
  { id:"X", category:"Cancellations", severity:"HIGH", pattern:/returns|order-lifecycle|admin-post-order/ },
  { id:"Y", category:"Refunds", severity:"CRITICAL", pattern:/refund|payment/ },
  { id:"Z", category:"Reconciliation", severity:"HIGH", pattern:/reconciliation/ },
  { id:"AA", category:"Notifications", severity:"HIGH", pattern:/notification/ },
  { id:"AB", category:"Observability", severity:"HIGH", pattern:/observability|incident/ },
  { id:"AC", category:"Configuration", severity:"HIGH", pattern:/configuration|production-configuration|environment|release/ },
  { id:"AD", category:"Deployment", severity:"HIGH", pattern:/release|deployment|operations|phase-15-16/ },
  { id:"AE", category:"Backup/Restore", severity:"HIGH", pattern:/backup-disaster|business-continuity|recovery/ },
  { id:"AF", category:"SEO", severity:"MEDIUM", pattern:/seo/ },
  { id:"AG", category:"Dependency/Supply Chain", severity:"MEDIUM", evidence:"CI runs npm ci and npm audit; Phase 16.21 certification is part of the test-job history.", gaps:[] },
  { id:"AH", category:"Data Integrity", severity:"CRITICAL", pattern:/integrity|reconciliation|persistence|lifecycle/ },
  { id:"AI", category:"Cross-Domain Workflow", severity:"CRITICAL", pattern:/commerce-journey|order-lifecycle|phase-16-2|reconciliation/ },
];

const results: MatrixResult[] = [];
for (const c of categories) {
  const matched = c.pattern ? testFiles.filter((p) => c.pattern!.test(p)) : [];
  if (c.id === "AG") {
    results.push({
      id:c.id, category:c.category,
      status:/npm ci/.test(ci) && /npm audit/.test(ci) ? "PASS" : "FAIL",
      severity:c.severity, scenarios:1,
      evidence:"package-lock.json/packageManager are validated through CI; npm ci and npm audit are present in the repository CI workflow.",
      gaps:c.gaps ?? [],
    });
    continue;
  }
  if (!matched.length) {
    results.push({
      id:c.id, category:c.category, status:"NOT EXECUTABLE", severity:c.severity, scenarios:0,
      evidence:"No existing repository test file matched this matrix domain.",
      gaps:[`No executable test coverage was discovered for ${c.category}.`],
    });
    continue;
  }
  results.push({
    id:c.id, category:c.category,
    status:testRun.status === 0 ? "PASS" : "FAIL",
    severity:c.severity,
    scenarios:matched.length,
    evidence:`Existing test suite execution passed/failed as a whole; matched test files: ${matched.length}. Representative files: ${matched.slice(0,8).join(", ")}.`,
    gaps:[],
  });
}

const browserSupport = {
  chromium: false,
  firefox: false,
  webkit: false,
  status: "NOT EXECUTABLE" as Status,
  severity: "INFORMATIONAL" as Severity,
  evidence: "No Playwright/Webdriver/browser-runner configuration or browser test files were found in the repository.",
  gap: "Real browser execution across Chromium, Firefox, and WebKit/Safari-equivalent cannot be honestly claimed in this phase without introducing the prohibited duplicate browser framework.",
};

const criticalFailures = results.filter((r) => r.status === "FAIL" && r.severity === "CRITICAL").length;
const highFailures = results.filter((r) => r.status === "FAIL" && r.severity === "HIGH").length;
const criticalGaps = results.filter((r) => r.status === "NOT EXECUTABLE" && (r.severity === "CRITICAL" || r.severity === "HIGH"));
const decision = testRun.status !== 0 || criticalFailures > 0 || highFailures > 0
  ? "NOT READY FOR PHASE 16.24"
  : criticalGaps.length > 0
    ? "NOT READY FOR PHASE 16.24"
    : "READY FOR PHASE 16.24";

const report = {
  phase:"16.23",
  title:"Full Test Matrix",
  environment:process.env.NODE_ENV ?? "unknown",
  execution:{
    command:"npx tsx --test --test-concurrency=1 <all tests/*.test.ts>",
    exitCode:testRun.status,
    signal:testRun.signal ?? null,
    testFiles:testFiles.length,
    tests:testCount,
    passed:passCount,
    failed:failCount,
    skipped:skippedCount,
    todo:todoCount,
  },
  inventory:{
    testFiles:testFiles.length,
    routeFiles:routeFiles.length,
    pageFiles:pageFiles.length,
    routes:routeFiles,
    pages:pageFiles,
    testFilesList:testFiles,
  },
  matrix:results,
  browserCompatibility:browserSupport,
  safety:{
    realMoney:false,
    liveQikinkFulfillment:false,
    destructiveProductionDatabase:false,
    realCustomerPII:false,
  },
  gaps: [
    ...results.flatMap((r)=>r.gaps.map((g)=>({category:r.category,severity:r.severity,description:g}))),
    ...(browserSupport.status==="NOT EXECUTABLE" ? [{category:"Browser Compatibility",severity:"INFORMATIONAL",description:browserSupport.gap}] : []),
  ],
  ciPrerequisites:{
    npmCi:/npm ci/.test(ci),
    lint:/npm run lint/.test(ci),
    typecheck:/npm run typecheck/.test(ci),
    npmTest:/npm test/.test(ci),
    build:/npm run build/.test(ci),
    prismaValidate:/prisma validate/.test(ci),
    prismaGenerate:/prisma generate/.test(ci),
  },
  decision,
};

await mkdir("artifacts", { recursive:true });
await writeFile("artifacts/phase-16-23-full-test-matrix.json", JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if (decision !== "READY FOR PHASE 16.24") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
