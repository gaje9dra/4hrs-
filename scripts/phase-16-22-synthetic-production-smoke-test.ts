import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { db } from "@/lib/db/client";
import { executeSyntheticWorkflow, syntheticSummary } from "@/lib/synthetic/service";
import { WORKFLOW_REGISTRY } from "@/lib/synthetic/registry";

type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT EXECUTABLE";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Result = {
  id: string;
  domain: string;
  action: string;
  expected: string;
  actual: string;
  status: Status;
  severity: Severity;
  evidence: string;
  cleanup: string;
};

const baseUrl = (process.env.PHASE_16_22_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const target = new URL(baseUrl);
if (!["localhost", "127.0.0.1"].includes(target.hostname) || process.env.PHASE_16_22_ALLOW_LOCAL_SYNTHETIC !== "true") {
  throw new Error("Phase 16.22 mutation-capable smoke fixture execution is restricted to an explicitly allowlisted local CI target.");
}
const runId = process.env.PHASE_16_22_RUN_ID ?? `phase-16-22-${Date.now()}-${randomUUID().slice(0,8)}`;
const results: Result[] = [];
const syntheticCreated: string[] = [];
const syntheticCategoryCreated: string[] = [];

function add(result: Result) { results.push(result); }
function safeBody(body: string) {
  return !/(DATABASE_URL|DIRECT_URL|QIKINK_(AUTH_TOKEN|CLIENT_SECRET|SANDBOX_SECRET)|PAYMENT_PROVIDER_SECRET|SESSION_SECRET|passwordHash)/i.test(body);
}

async function http(id: string, domain: string, path: string, expected: string, allowed: number[], severity: Severity = "HIGH", options: RequestInit = {}) {
  const url = new URL(path, baseUrl).toString();
  const started = Date.now();
  try {
    const response = await fetch(url, { ...options, redirect: "manual", cache: "no-store", headers: { "x-smoke-test-run-id": runId, ...(options.headers ?? {}) } });
    const body = await response.text();
    const duration = Date.now() - started;
    const status = allowed.includes(response.status) && safeBody(body) ? "PASS" : "FAIL";
    add({
      id, domain, action: `${options.method ?? "GET"} ${path}`, expected,
      actual: `HTTP ${response.status}; ${duration}ms; secret-scan=${safeBody(body) ? "clean" : "unsafe"}`,
      status, severity,
      evidence: `run=${runId}; url=${url}; status=${response.status}; content-type=${response.headers.get("content-type") ?? "unknown"}`,
      cleanup: "Read-only request; no cleanup required.",
    });
    return { response, body };
  } catch (error) {
    add({ id, domain, action: `${options.method ?? "GET"} ${path}`, expected, actual: error instanceof Error ? error.message : "request failed", status: "FAIL", severity, evidence: `run=${runId}; url=${url}`, cleanup: "No side effect was created." });
    return null;
  }
}

async function prepareSyntheticCatalog() {
  let categoryId: string | null = null;
  const existing = await db.product.findFirst({
    where: { status: "ACTIVE", variants: { some: { status: "ACTIVE" } } },
    select: { id: true, slug: true, variants: { where: { status: "ACTIVE" }, take: 1, select: { id: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (existing?.variants[0]) {
    const linked = await db.productCategory.findFirst({ where: { productId: existing.id, category: { status: "ACTIVE" } }, select: { categoryId: true, category: { select: { slug: true } } } });
    if (linked) { categoryId = linked.categoryId; }
    if (!categoryId) {
      const category = await db.category.create({ data: { name: "4HRS+ Synthetic Smoke Category", slug: `phase-16-22-smoke-category-${randomUUID().replaceAll("-", "")}`, status: "ACTIVE" } });
      await db.productCategory.create({ data: { productId: existing.id, categoryId: category.id } });
      syntheticCategoryCreated.push(category.id);
      categoryId = category.id;
    }
    return { productId: existing.id, slug: existing.slug, variantId: existing.variants[0].id, categoryId, categorySlug: categoryId ? (await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { slug: true } })).slug : null, created: false };
  }

  const suffix = randomUUID().replaceAll("-", "");
  const product = await db.product.create({
    data: {
      title: "4HRS+ Synthetic Smoke Fixture",
      slug: `phase-16-22-smoke-${suffix}`,
      description: "Synthetic-only smoke-test fixture. Not a customer product.",
      shortDescription: "Synthetic smoke fixture.",
      price: "499.00",
      currency: "INR",
      status: "ACTIVE",
      variants: {
        create: {
          sku: `PHASE-16-22-${suffix.slice(0, 12)}`,
          displayName: "Synthetic / M",
          size: "M",
          color: "Synthetic",
          status: "ACTIVE",
        },
      },
    },
    include: { variants: true },
  });
  syntheticCreated.push(product.id);
  const category = await db.category.create({ data: { name: "4HRS+ Synthetic Smoke Category", slug: `phase-16-22-smoke-category-${suffix}`, status: "ACTIVE" } });
  syntheticCategoryCreated.push(category.id);
  await db.productCategory.create({ data: { productId: product.id, categoryId: category.id } });
  return { productId: product.id, slug: product.slug, variantId: product.variants[0].id, categoryId: category.id, categorySlug: category.slug, created: true };
}

async function runCriticalBoundaryTests() {
  const testFiles = [
    "tests/storefront-homepage.test.ts",
    "tests/storefront-listing.test.ts",
    "tests/storefront-product-detail.test.ts",
    "tests/cart-domain-service.test.ts",
    "tests/cart-api-contract.test.ts",
    "tests/checkout-domain.test.ts",
    "tests/checkout-ui.test.ts",
    "tests/payment-domain-service.test.ts",
    "tests/payment-persistence.test.ts",
    "tests/payment-provider-adapter.test.ts",
    "tests/order-creation.test.ts",
    "tests/order-lifecycle.test.ts",
    "tests/fulfillment-domain.test.ts",
    "tests/provider-mapping.test.ts",
    "tests/qikink-provider.test.ts",
    "tests/shipping-application.test.ts",
    "tests/shipping-provider-capabilities.test.ts",
    "tests/shipping-retry.test.ts",
    "tests/customer-account-security.test.ts",
    "tests/admin-platform-foundation.test.ts",
    "tests/admin-payment-operations.test.ts",
    "tests/admin-fulfillment-operations.test.ts",
    "tests/admin-shipping-operations.test.ts",
    "tests/reconciliation.test.ts",
    "tests/synthetic-monitoring.test.ts",
  ];
  const { spawnSync } = await import("node:child_process");
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const run = spawnSync(command, ["tsx", "--test", "--test-concurrency=1", ...testFiles], { stdio: "inherit", env: process.env });
  add({
    id: "16.22-DOMAIN-SUITE", domain: "Critical business boundaries",
    action: "Execute existing commerce/auth/admin/reconciliation/synthetic test suites",
    expected: "Existing repository tests pass without weakened assertions.",
    actual: `exit=${run.status ?? "signal"}`,
    status: run.status === 0 ? "PASS" : "FAIL",
    severity: "CRITICAL",
    evidence: `run=${runId}; ${testFiles.length} existing test files; command=tsx --test --test-concurrency=1`,
    cleanup: "Each existing suite owns its fixtures/cleanup.",
  });
  if (run.status !== 0) throw new Error("Critical domain smoke suite failed.");
}

async function main() {
  const fixture = await prepareSyntheticCatalog();
  if (!fixture.categorySlug) throw new Error("Phase 16.22 requires a synthetic category fixture for category smoke validation.");
  process.env.PHASE_16_22_CATEGORY_SLUG = fixture.categorySlug;

  await http("16.22-HEALTH", "Health", "/api/health", "200 with status=ok and no sensitive data", [200], "HIGH");
  await http("16.22-READYNESS", "Readiness", "/api/readiness", "200 with ready status and database check", [200], "HIGH");
  await http("16.22-READY", "Readiness", "/api/ready", "200 with ready status", [200], "HIGH");
  await http("16.22-HOME", "Storefront", "/", "successful storefront HTML", [200], "CRITICAL");
  await http("16.22-SHOP", "Storefront", "/shop", "successful catalog route", [200], "CRITICAL");
  await http("16.22-SEARCH", "Search", "/search?q=shirt", "successful search route", [200], "HIGH");
  await http("16.22-PRODUCT", "Product", `/product/${encodeURIComponent(fixture.slug)}`, "successful active synthetic product route", [200], "HIGH");
  await http("16.22-CART-AUTH", "Cart security", "/api/cart", "unauthenticated cart access is rejected safely", [401,403], "CRITICAL");
  await http("16.22-CHECKOUT-AUTH", "Checkout security", "/api/checkout", "unauthenticated checkout remains safely non-mutating/rejected", [401,403,422], "HIGH");
  await http("16.22-PAYMENT-AUTH", "Payment security", "/api/payment", "unauthenticated payment access is rejected", [401,403], "CRITICAL");
  await http("16.22-ORDER-AUTH", "Order security", "/api/order", "unauthenticated order access is rejected or safely empty", [401,403,200], "CRITICAL");
  await http("16.22-ADMIN-AUTH", "Admin/RBAC", "/api/admin/orders", "unauthenticated admin access is rejected", [401,403], "CRITICAL");

  const safeWorkflowIds = WORKFLOW_REGISTRY.filter(w => w.productionSafe).map(w => w.id);
  const workflowResults = [];
  for (const id of safeWorkflowIds) {
    const execution = await executeSyntheticWorkflow(id, "CI", { baseUrl, reason: "Phase 16.22 controlled local production-like smoke run", correlationId: `${runId}:${id}` });
    workflowResults.push({ id, status: execution.status, failureCode: execution.failureCode, executionId: execution.id });
    const workflow = WORKFLOW_REGISTRY.find(w => w.id === id)!;
    add({
      id: `SYN-${id}`, domain: workflow.domains.join(","),
      action: workflow.entryPoint, expected: workflow.expectedOutcome,
      actual: `status=${execution.status}; failure=${execution.failureCode ?? "none"}`,
      status: execution.status === "HEALTHY" ? "PASS" : execution.status === "BLOCKED" || execution.status === "UNAVAILABLE" ? "NOT EXECUTABLE" : "FAIL",
      severity: workflow.failureSeverity === "P0" ? "CRITICAL" : workflow.failureSeverity === "P1" ? "HIGH" : "MEDIUM",
      evidence: `run=${runId}; execution=${execution.id}; workflow=${id}`,
      cleanup: "Synthetic execution records are marked with synthetic mode and cleanupStatus by the existing synthetic service.",
    });
  }

  await runCriticalBoundaryTests();

  const summary = await syntheticSummary();
  const failures = results.filter(r => r.status === "FAIL");
  const criticalFailures = failures.filter(r => r.severity === "CRITICAL");
  const highFailures = failures.filter(r => r.severity === "HIGH");

  const report = {
    phase: "16.22",
    title: "Synthetic Production Smoke Test",
    runId,
    environment: process.env.NODE_ENV ?? "unknown",
    baseUrl,
    safety: {
      financialMutation: false,
      livePayment: false,
      liveQikinkFulfillment: false,
      liveShippingMutation: false,
      notificationToRealCustomer: false,
      productionDatabaseDestructiveOperation: false,
    },
    syntheticFixture: { productId: fixture.productId, variantId: fixture.variantId, createdByRun: fixture.created },
    results,
    workflowResults,
    syntheticSummary: summary,
    counts: {
      executed: results.filter(r => r.status !== "NOT EXECUTABLE" && r.status !== "BLOCKED").length,
      passed: results.filter(r => r.status === "PASS").length,
      failed: failures.length,
      blocked: results.filter(r => r.status === "BLOCKED").length,
      notExecutable: results.filter(r => r.status === "NOT EXECUTABLE").length,
      criticalFailures: criticalFailures.length,
      highFailures: highFailures.length,
    },
    limitations: [
      "Payment success/failure mutations are not executed because no verified live-money sandbox contract is available in this CI environment.",
      "Qikink live fulfillment is never executed; the existing provider-neutral safety boundary and controlled adapter tests are used instead.",
      "Shipping mutation and real external tracking are not fabricated; unsupported provider capabilities remain explicit.",
      "The smoke environment is an isolated GitHub Actions PostgreSQL service and a local production Next.js server, not the live Netlify account.",
    ],
    decision: criticalFailures.length || highFailures.length ? "NOT READY FOR PHASE 16.23" : "READY FOR PHASE 16.23",
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/phase-16-22-synthetic-production-smoke-test.json", JSON.stringify(report, null, 2) + "\n");

  console.log(JSON.stringify(report, null, 2));
  if (criticalFailures.length || highFailures.length) process.exitCode = 1;
}

main().catch(async error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}).finally(async () => {
  if (syntheticCreated.length) {
    await db.productCategory.deleteMany({ where: { productId: { in: syntheticCreated } } }).catch(() => undefined);
    await db.productVariant.deleteMany({ where: { productId: { in: syntheticCreated } } }).catch(() => undefined);
    await db.product.deleteMany({ where: { id: { in: syntheticCreated } } }).catch(() => undefined);
  }
  if (syntheticCategoryCreated.length) {
    await db.category.deleteMany({ where: { id: { in: syntheticCategoryCreated } } }).catch(() => undefined);
  }
});
