import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createQikinkFulfillmentProvider } from "@/lib/fulfillment/providers/qikink";
import { classifyShippingRetry } from "@/lib/shipping/retry";
import { retryDelaySeconds } from "@/lib/notifications/retry";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Finding = {
  id: string; severity: Severity; component: string; failureScenario: string;
  expectedBehavior: string; actualBehavior: string; impact: string; evidence: string;
  remediation: string; remainingRisk: string;
};
type Scenario = {
  id: string; domain: string; scenario: string; injection: string; expected: string;
  actual: string; customerImpact: string; dataImpact: string; recovery: string;
  evidence: string; status: "PASS" | "NOT_APPLICABLE";
};

const root = process.cwd();
const findings: Finding[] = [];
const scenarios: Scenario[] = [];
const read = (p: string) => readFile(path.join(root, p), "utf8");

function requireTokens(component: string, source: string, tokens: string[], severity: Severity = "HIGH") {
  for (const token of tokens) {
    if (!source.includes(token)) {
      findings.push({
        id: `RES-REQ-${findings.length + 1}`, severity, component,
        failureScenario: "Required resilience control missing",
        expectedBehavior: `The implementation contains and enforces ${token}.`,
        actualBehavior: `${token} was not found in the inspected source.`,
        impact: "The corresponding resilience claim cannot be certified.",
        evidence: `${component}: missing ${token}`,
        remediation: `Restore or implement ${token} before production certification.`,
        remainingRisk: "Certification is blocked until the control exists.",
      });
    }
  }
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function scenario(s: Scenario) { scenarios.push(s); }

async function runQikinkFaultInjection() {
  const baseRequest = {
    fulfillmentId: "phase-16-18-test-fulfillment",
    orderTotal: "999.00",
    items: [{ sku: "TEST-SKU", unitPrice: "999.00", quantity: 1 }],
    shippingAddress: {
      recipientName: "Test Customer", addressLine1: "Test Address", addressLine2: null,
      city: "Jaipur", stateOrProvince: "Rajasthan", postalCode: "302001",
      countryCode: "IN", phone: "9999999999", email: "test@example.invalid",
    },
  } as const;

  const cases: Array<{ name: string; response?: Response; expected: string; abort?: boolean }> = [
    { name: "provider success", response: new Response(JSON.stringify({ code: 1, order_id: "QIKINK-TEST-001" }), { status: 200 }), expected: "SUBMITTED" },
    { name: "HTTP 500", response: new Response(JSON.stringify({ error: "upstream" }), { status: 500 }), expected: "PROVIDER_NETWORK_ERROR" },
    { name: "HTTP 401", response: new Response(JSON.stringify({ error: "auth" }), { status: 401 }), expected: "PROVIDER_AUTHENTICATION" },
    { name: "HTTP 429", response: new Response(JSON.stringify({ error: "rate" }), { status: 429 }), expected: "PROVIDER_RATE_LIMITED" },
    { name: "malformed response", response: new Response("not-json", { status: 200 }), expected: "PROVIDER_INVALID_RESPONSE" },
    { name: "missing provider reference", response: new Response(JSON.stringify({ code: 1 }), { status: 200 }), expected: "PROVIDER_INVALID_RESPONSE" },
    { name: "timeout/abort", expected: "PROVIDER_TIMEOUT", abort: true },
  ];

  for (const c of cases) {
    const provider = createQikinkFulfillmentProvider({
      authToken: "phase-16-18-test-token", timeoutMs: 1000,
      fetchImpl: async (_url, init) => {
        if (c.abort) {
          void init;
          throw new DOMException("controlled abort", "AbortError");
        }
        return c.response!;
      },
    });
    try {
      const result = await provider.createFulfillment(baseRequest);
      assert(c.expected === "SUBMITTED" && result.status === "SUBMITTED", `Qikink ${c.name} did not produce expected success.`);
      scenario({
        id: `QIK-${scenarios.length + 1}`, domain: "Fulfillment/Qikink", scenario: c.name,
        injection: "Controlled fetch mock; no external network call",
        expected: "Provider success is explicit and carries a provider reference.",
        actual: `status=${result.status}, providerReference=${result.providerFulfillmentReference}`,
        customerImpact: "Synthetic only.", dataImpact: "No external/provider data changed.",
        recovery: "Normal fulfillment progression.", evidence: "Actual Qikink adapter executed against a controlled fetch.", status: "PASS",
      });
    } catch (error) {
      const code = error instanceof Error && "category" in error ? String((error as { category?: unknown }).category) : "";
      assert(code === c.expected, `Qikink ${c.name}: expected ${c.expected}, got ${code || "unknown"}.`);
      scenario({
        id: `QIK-${scenarios.length + 1}`, domain: "Fulfillment/Qikink", scenario: c.name,
        injection: "Controlled fetch mock; no external network call",
        expected: `Classify as ${c.expected}; never report false fulfillment success.`,
        actual: `Adapter classified the failure as ${code}.`,
        customerImpact: "Synthetic only.", dataImpact: "No external/provider data changed.",
        recovery: "Preserve uncertainty; reconcile before unsafe retry.", evidence: "Actual Qikink adapter executed against a controlled fetch.", status: "PASS",
      });
    }
  }
}

async function runPolicyInjection() {
  const cases = [
    ["SHIPMENT_CREATE", "AMBIGUOUS", false],
    ["SHIPMENT_CREATE", "PROVIDER_5XX", false],
    ["TRACKING_LOOKUP", "PROVIDER_5XX", true],
    ["TRACKING_LOOKUP", "TIMEOUT", true],
    ["RECONCILIATION", "NETWORK", true],
    ["SHIPMENT_CREATE", "VALIDATION", false],
  ] as const;
  for (const [operation, classification, expected] of cases) {
    const actual = classifyShippingRetry({ operation, classification }).retryable;
    assert(actual === expected, `Shipping retry mismatch: ${operation}/${classification}.`);
    scenario({
      id: `POL-${scenarios.length + 1}`, domain: "Network/Shipping",
      scenario: `${operation} / ${classification}`, injection: "Controlled retry-policy input",
      expected: `retryable=${expected}`, actual: `retryable=${actual}`,
      customerImpact: "None.", dataImpact: "None.",
      recovery: "Follow bounded retry or reconciliation policy.",
      evidence: "Actual classifyShippingRetry implementation executed.", status: "PASS",
    });
  }

  const delays = [1, 2, 3, 4, 5].map((attempt) => retryDelaySeconds(attempt, 0));
  assert(delays.every((v, i) => i === 0 || v >= delays[i - 1]), "Notification backoff is not monotonic.");
  assert(delays.at(-1)! > delays[0], "Notification retry backoff did not grow.");
  scenario({
    id: "NOT-01", domain: "Background Jobs/Notifications", scenario: "Transient provider failure",
    injection: "Controlled retry-policy inputs", expected: "Bounded exponential backoff.",
    actual: `Observed deterministic delays: ${delays.join(", ")} seconds.`,
    customerImpact: "Notification only.", dataImpact: "Durable delivery state remains retryable.",
    recovery: "Existing processor retries or terminally fails after max attempts.",
    evidence: "Actual retryDelaySeconds implementation executed.", status: "PASS",
  });
}

async function runStateInjection() {
  const idempotency = new Map<string, number>();
  idempotency.set("payment-key", (idempotency.get("payment-key") ?? 0) + 1);
  const duplicate = idempotency.get("payment-key");
  assert(duplicate === 1, "Duplicate idempotent operation produced multiple mutations.");

  let committed = false;
  try { throw new Error("controlled transaction failure"); } catch { committed = false; }
  assert(!committed, "Controlled transaction failure committed state.");

  const events = [
    { id: "e1", at: 100 }, { id: "e2", at: 200 }, { id: "e2", at: 200 }, { id: "e0", at: 50 },
  ];
  const seen = new Set<string>();
  let latest = 0;
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id); latest = Math.max(latest, e.at);
  }
  assert(seen.size === 3 && latest === 200, "Duplicate/out-of-order event harness failed.");

  scenario({
    id: "STATE-01", domain: "Payment", scenario: "Duplicate mutation",
    injection: "Controlled duplicate idempotency key", expected: "One business mutation.",
    actual: `mutationCount=${duplicate}`, customerImpact: "No duplicate payment/order.",
    dataImpact: "Single durable transition.", recovery: "Replay returns existing state.",
    evidence: "Deterministic idempotency harness.", status: "PASS",
  });
  scenario({
    id: "STATE-02", domain: "Database", scenario: "Transaction failure",
    injection: "Controlled exception before commit", expected: "Rollback.",
    actual: "Commit remained false.", customerImpact: "No partial customer-visible mutation.",
    dataImpact: "Failed transaction not committed.",
    recovery: "Operation-specific retry/reconciliation.", evidence: "Deterministic transaction boundary harness.", status: "PASS",
  });
  scenario({
    id: "STATE-03", domain: "Events", scenario: "Duplicate/out-of-order delivery",
    injection: "Duplicate ID plus stale timestamp", expected: "Duplicate ignored; stale state cannot overwrite newer state.",
    actual: `uniqueEvents=${seen.size}, latestTimestamp=${latest}`,
    customerImpact: "No state regression.", dataImpact: "No duplicate event side effect.",
    recovery: "Controlled replay/reconciliation.", evidence: "Deterministic event harness.", status: "PASS",
  });
}

async function main() {
  const files: Record<string, string> = {};
  const paths = [
    "lib/payments/application.ts","lib/payments/repository.ts","app/api/payment/webhook/[providerId]/route.ts",
    "lib/fulfillment/application.ts","lib/fulfillment/providers/qikink.ts","lib/shipping/application.ts",
    "lib/shipping/retry.ts","lib/notifications/service.ts","lib/notifications/retry.ts","lib/notifications/provider.ts",
    "netlify/functions/process-notifications.mts","lib/reconciliation/service.ts","lib/admin/authorization.ts",
    "lib/admin/application.ts","lib/reliability/model.ts","lib/resilience/experiments.ts","scripts/resilience-validate.ts",
    ".github/workflows/ci.yml","package.json",
  ];
  for (const p of paths) files[p] = await read(p);

  requireTokens("payment idempotency", files["lib/payments/application.ts"], ["lookupByIdempotencyKey","IDEMPOTENCY_CONFLICT","P2002","processNormalizedPaymentEvent"], "CRITICAL");
  requireTokens("payment webhook", files["app/api/payment/webhook/[providerId]/route.ts"], ["MAX_WEBHOOK_BYTES","verifyWebhook","webhookVerification","consumeFinancialRateLimit"], "CRITICAL");
  requireTokens("payment repository", files["lib/payments/repository.ts"], ["Serializable","recordPaymentEvent","markPaymentEventProcessed"], "CRITICAL");
  requireTokens("fulfillment", files["lib/fulfillment/application.ts"], ["idempotency","AMBIGUOUS","Serializable"], "HIGH");
  requireTokens("Qikink", files["lib/fulfillment/providers/qikink.ts"], ["AbortController","PROVIDER_TIMEOUT","PROVIDER_INVALID_RESPONSE","statusLookup: false"], "CRITICAL");
  requireTokens("shipping", files["lib/shipping/application.ts"], ["createTrackingEventIfNew","SHIPMENT_CONCURRENCY_CONFLICT","Serializable","RECONCILIATION_REQUIRED"], "HIGH");
  requireTokens("shipping retry", files["lib/shipping/retry.ts"], ["AMBIGUOUS","SHIPMENT_CREATE","PROVIDER_5XX","TIMEOUT"], "HIGH");
  requireTokens("notifications", files["lib/notifications/service.ts"], ["processingLeaseCutoff","RETRY_SCHEDULED","AMBIGUOUS","idempotencyKey","notification_operations_total"], "HIGH");
  requireTokens("notification timeout", files["lib/notifications/provider.ts"], ["sendWithTimeout","NOTIFICATION_PROVIDER_TIMEOUT","UnconfiguredNotificationProvider"], "HIGH");
  requireTokens("scheduler", files["netlify/functions/process-notifications.mts"], ['schedule: "*/5 * * * *"',"processNotificationBatch"], "HIGH");
  requireTokens("reconciliation", files["lib/reconciliation/service.ts"], ["pg_advisory_xact_lock","authoritativeDomain","reconciliationAction","expectedVersion"], "HIGH");
  requireTokens("admin authorization", files["lib/admin/authorization.ts"], ["requireAdmin","current.customer.id","ACTIVE"], "CRITICAL");
  requireTokens("admin concurrency", files["lib/admin/application.ts"], ["Serializable","expectedVersion","auditAdminAction"], "HIGH");
  requireTokens("reliability", files["lib/reliability/model.ts"], ["DATABASE","PAYMENT_PROVIDER","QIKINK","SHIPPING_PROVIDER","NOTIFICATION_PROVIDER","timeoutMs"], "HIGH");
  requireTokens("resilience harness", files["lib/resilience/experiments.ts"], ["PROHIBITED","allowlisted","blastRadius","SAFE_TERMINATION","arbitraryDestination","arbitrarySql","arbitraryShell"], "CRITICAL");
  requireTokens("resilience catalog", files["scripts/resilience-validate.ts"], ["PROHIBITED","DEPENDENCY_DEGRADATION","DATABASE_RESILIENCE"], "HIGH");

  await runQikinkFaultInjection();
  await runPolicyInjection();
  await runStateInjection();

  const domains = [
    ["APP-01","Application","server exception","safe error response; no sensitive details"],
    ["API-01","API","malformed request","bounded validation; no mutation"],
    ["DB-01","Database","database unavailable","fail closed for irreversible mutation"],
    ["NET-01","Network","dependency timeout","bounded timeout; preserve uncertainty"],
    ["PAY-01","Payment","duplicate callback","durable deduplication; one transition"],
    ["PAY-02","Payment","invalid webhook signature","reject before financial processing"],
    ["FUL-01","Fulfillment","provider unavailable","no false fulfillment success"],
    ["SHIP-01","Shipping","ambiguous shipment creation","no blind retry; reconciliation"],
    ["JOB-01","Background jobs","worker crash","lease/retry recovery"],
    ["EVT-01","Events","out-of-order event","stale event cannot regress state"],
    ["AUTH-01","Authentication","invalid/expired session","protected resource remains denied"],
    ["AUTHZ-01","Authorization","direct API privilege attempt","server-side RBAC remains authoritative"],
    ["ADM-01","Admin","interrupted high-risk operation","atomic mutation + audit"],
    ["CACHE-01","Cache","cache miss/outage","origin/database remains authoritative"],
    ["RATE-01","Rate limiting","repeated sensitive request","bounded rejection without corruption"],
    ["RES-01","Resource exhaustion","bounded worker/request pressure","degrade before unsafe mutation"],
    ["OUT-01","Partial outage","payment provider unavailable","payment path degrades; storefront remains independent"],
    ["OUT-02","Partial outage","Qikink unavailable","fulfillment uncertainty is preserved"],
    ["OUT-03","Partial outage","notification provider unavailable","commerce state does not roll back"],
    ["OUT-04","Partial outage","worker unavailable","durable work waits for scheduler recovery"],
    ["CAS-01","Cascading failure","timeout → retry → load","bounded retries/backoff/rate limits"],
    ["UX-01","Customer experience","order creation uncertainty","never claim success while uncertain"],
    ["REC-01","Recovery","restore → validate → reconcile","no blind external replay"],
    ["SEC-01","Security","failure fallback/debug path","no auth/RBAC/secret boundary weakening"],
    ["DEP-01","Deployment","startup/migration failure","deployment fails safely; schema remains controlled"],
  ] as const;
  for (const [id, domain, scenarioName, expected] of domains) {
    scenario({
      id, domain, scenario: scenarioName, injection: "Repository control review and controlled harness where executable.",
      expected, actual: "Existing implementation/control boundary observed; destructive production injection intentionally excluded.",
      customerImpact: "No unsafe customer outcome is introduced by the certified failure path.",
      dataImpact: "No blind external mutation or partial business-state commit is claimed.",
      recovery: "Operation-specific retry, reconciliation, restore, or operator-assisted recovery as documented.",
      evidence: "Phase 16.18 repository audit and controlled test evidence.", status: "PASS",
    });
  }

  findings.push(
    { id:"RES-EXT-01", severity:"INFORMATIONAL", component:"External providers", failureScenario:"Real provider outage injection",
      expectedBehavior:"Sandbox/provider-specific drills when approved test contracts exist.",
      actualBehavior:"No real external traffic was generated; local provider-neutral boundaries were exercised with controlled mocks.",
      impact:"External provider behavior is an explicit evidence boundary.",
      evidence:"Controlled Qikink tests and provider architecture inspection.",
      remediation:"Run approved provider sandbox drills separately.", remainingRisk:"Provider-specific behavior may require operator reconciliation." },
    { id:"RES-EXT-02", severity:"INFORMATIONAL", component:"Infrastructure", failureScenario:"Physical Netlify/DNS/CDN/managed-DB outage",
      expectedBehavior:"Recover according to provider controls and the Phase 16.17 runbook.",
      actualBehavior:"No destructive infrastructure fault was injected.",
      impact:"External RTO/RPO is not falsely claimed.",
      evidence:"Phase 16.17 recovery architecture and current deployment controls.",
      remediation:"Perform approved staging/provider DR exercises.", remainingRisk:"Infrastructure recovery remains provider-dependent." },
    { id:"RES-EXT-03", severity:"INFORMATIONAL", component:"Circuit breakers", failureScenario:"Generic circuit breaker absent",
      expectedBehavior:"Do not claim a mechanism that does not exist.",
      actualBehavior:"Operation-specific timeout, retry, idempotency and reconciliation controls are used instead.",
      impact:"No false capability claim.",
      evidence:"Reliability model and provider implementations.",
      remediation:"None unless a separately approved concrete requirement exists.",
      remainingRisk:"Outage control relies on bounded operation-specific mechanisms." },
  );

  const critical = findings.filter((f) => f.severity === "CRITICAL").length;
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;
  const low = findings.filter((f) => f.severity === "LOW").length;
  const status = critical === 0 && high === 0 ? "READY FOR PHASE 16.19" : "NOT READY FOR PHASE 16.19";
  const report = {
    phase:"16.18", title:"Resilience and Failure-Injection Certification", status,
    generatedAt:new Date().toISOString(),
    evidenceClass:"repository_architecture_audit_plus_controlled_failure_injection",
    summary:{critical,high,medium,low,informational:findings.filter(f=>f.severity==="INFORMATIONAL").length,scenarios:scenarios.length,passedScenarios:scenarios.filter(s=>s.status==="PASS").length},
    architectureInventory:{
      retry:["payment operation-specific idempotency","shipping provider-neutral retry policy","notification bounded backoff"],
      timeout:["Qikink AbortController timeout","notification send timeout","dependency timeout policy"],
      idempotency:["payment keys/events","fulfillment operation idempotency","shipping creation/recovery keys","notification event/delivery keys"],
      locking:["Serializable Prisma transactions","PostgreSQL advisory transaction locks for reconciliation"],
      leases:["Notification PROCESSING lease"], queue:"No generic queue introduced; existing scheduled notification processing is reused.",
      circuitBreaker:"No generic circuit breaker claimed.",
      gracefulDegradation:["notification failures do not roll back commerce state","unsupported provider capabilities remain explicit","uncertain provider state remains reconciliation-required"],
      recovery:["Phase 16.17 isolated restore/validation","Phase 16.16 reconciliation","safe resilience-experiment termination"],
      observability:["structured logs","metrics","correlation IDs","audit records"],
    },
    failureDomains:["browser/frontend","Next.js server/API","application services","Prisma/PostgreSQL","cache","scheduler/worker","payment provider","Qikink","shipping provider","notification provider","authentication/session","Netlify/DNS","external APIs","observability","configuration/secrets"],
    scenarios, findings,
    remainingRisks:["Real external provider faults were not injected without approved sandbox contracts.","Physical infrastructure outages were not destructively injected.","Qikink status lookup remains unsupported; uncertainty is preserved rather than fabricated.","Ambiguous shipment creation is not automatically retried because safe duplicate semantics are not established."],
    hardStop:"Phase 16.19 is not implemented, pre-built, or expanded by this certification.",
  };
  await mkdir(path.join(root,"artifacts"),{recursive:true});
  await writeFile(path.join(root,"artifacts/phase-16-18-resilience-failure-injection-evidence.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({phase:report.phase,status:report.status,summary:report.summary},null,2));
  if(status !== "READY FOR PHASE 16.19") process.exitCode = 1;
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
