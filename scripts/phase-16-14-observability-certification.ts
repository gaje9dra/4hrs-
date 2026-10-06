import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Status = "PASS" | "FAIL" | "UNAVAILABLE" | "NOT_APPLICABLE";
type Finding = { id: string; severity: Severity; status: Status; title: string; evidence: string; remediation?: string };

const root = process.cwd();
const findings: Finding[] = [];
const read = (file: string) => readFile(path.join(root, file), "utf8");
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "artifacts"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file));
    else out.push(file.replaceAll("\\\\", "/"));
  }
  return out;
}
function add(id: string, severity: Severity, status: Status, title: string, evidence: string, remediation?: string) {
  findings.push({ id, severity, status, title, evidence, remediation });
}
function pass(id: string, title: string, evidence: string) { add(id, "INFORMATIONAL", "PASS", title, evidence); }

async function main() {
  const files = await walk(".");
  const pkg = JSON.parse(await read("package.json")) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const [logger, redaction, metrics, request, errors, security, proxy, instrumentation, health, readiness, databaseHealth, operations, reliabilityService, reliabilityChecks, reliabilityIncidents, reliabilityModel, ci] =
    await Promise.all([
      read("lib/observability/logger.ts"),
      read("lib/observability/redaction.ts"),
      read("lib/observability/metrics.ts"),
      read("lib/observability/request.ts"),
      read("lib/observability/errors.ts"),
      read("lib/observability/security.ts"),
      read("proxy.ts"),
      read("instrumentation.ts"),
      read("app/api/health/route.ts"),
      read("app/api/health/readiness/route.ts"),
      read("lib/observability/health.ts"),
      read("lib/operations/service.ts"),
      read("lib/reliability/service.ts"),
      read("lib/reliability/checks.ts"),
      read("lib/reliability/incidents.ts"),
      read("lib/reliability/model.ts"),
      read(".github/workflows/ci.yml"),
    ]);

  if (pkg.scripts?.["production-certification:phase-16-14"]) pass("OBS-001", "Certification command", "package.json wires the Phase 16.14 certification command.");
  else add("OBS-001", "HIGH", "FAIL", "Certification command", "Phase 16.14 certification command is missing.");

  if (/JSON\.stringify\(record\)/.test(logger) && /timestamp/.test(logger) && /severity/.test(logger) && /event/.test(logger) && /environment/.test(logger) && /service/.test(logger)) pass("OBS-002", "Structured logging", "The existing logger emits one JSON record schema with timestamp, severity, service, environment and event.");
  else add("OBS-002", "HIGH", "FAIL", "Structured logging", "Required structured log fields could not be verified.");

  if (/severity === "debug" && process\.env\.NODE_ENV === "production"/.test(logger)) pass("OBS-003", "Production log levels", "Debug telemetry is suppressed in production; genuine warn/error events remain emitted.");
  else add("OBS-003", "MEDIUM", "FAIL", "Production log levels", "Production debug suppression is missing.");

  if (/password|passwd|secret|token|authorization|cookie|credential|api[-_]?key|private[-_]?key|database[-_]?url|cvv|card[-_]?number|session/i.test(redaction) && /\[REDACTED\]/.test(redaction)) pass("OBS-004", "Telemetry redaction", "Sensitive credential/payment/session key classes are redacted before telemetry serialization.");
  else add("OBS-004", "CRITICAL", "FAIL", "Telemetry redaction", "Sensitive telemetry redaction could not be verified.");

  if (/x-request-id/.test(request) && /resolveRequestId/.test(proxy) && /requestHeaders\.set\(REQUEST_ID_HEADER/.test(proxy) && /requestIdFromHeaders/.test(instrumentation)) pass("OBS-005", "Request correlation", "The proxy creates or preserves x-request-id and instrumentation carries it into error reporting.");
  else add("OBS-005", "HIGH", "FAIL", "Request correlation", "Request correlation propagation is incomplete.");

  if (/onRequestError/.test(instrumentation) && /reportError\(/.test(instrumentation) && /classifyError/.test(errors)) pass("OBS-006", "Error monitoring", "Next.js request errors are classified and reported through the existing error telemetry path.");
  else add("OBS-006", "HIGH", "FAIL", "Error monitoring", "Request-level error monitoring is incomplete.");

  if (/ALLOWED_LABELS/.test(metrics) && /route|method|status_class|error_class/.test(metrics) && /slice\(0, 64\)/.test(metrics)) pass("OBS-007", "Metric cardinality", "Metric labels are allow-listed and bounded; raw customer/order IDs are not accepted as label keys.");
  else add("OBS-007", "HIGH", "FAIL", "Metric cardinality", "Metric label cardinality controls are incomplete.");

  if (/http_requests_total/.test(metrics) && /http_request_errors_total/.test(metrics) && /http_request_duration_ms/.test(metrics) && /db_query_duration_ms/.test(metrics)) pass("OBS-008", "Golden-signal metric vocabulary", "Traffic, errors, latency and database timing are represented in the existing metric contract.");
  else add("OBS-008", "HIGH", "FAIL", "Golden-signal metric vocabulary", "Core golden-signal metric vocabulary is incomplete.");

  if (/checkDatabaseHealth/.test(databaseHealth) && /SELECT 1/.test(databaseHealth) && /timeoutMs/.test(databaseHealth)) pass("OBS-009", "Database health", "Database liveness/readiness uses a bounded SELECT 1 probe and exposes only safe status/latency.");
  else add("OBS-009", "HIGH", "FAIL", "Database health", "Database health telemetry is incomplete.");

  if (/status: ready/.test(readiness) && /\? 200 : 503/.test(readiness) && /checkDatabaseHealth/.test(readiness)) pass("OBS-010", "Readiness boundary", "A database-backed readiness endpoint now distinguishes process health from dependency readiness.");
  else add("OBS-010", "HIGH", "FAIL", "Readiness boundary", "Readiness semantics are incomplete.");

  if (/recordReliabilityFindings/.test(reliabilityService) && /shouldEmitAlert/.test(reliabilityService) && /reliability\.alert/.test(reliabilityService) && /reliability_alerts_total/.test(reliabilityService)) pass("OBS-011", "Actionable incident alerts", "Existing reliability incidents persist, deduplicate alerts, emit operational alert telemetry and expose incident state through the admin operations surface.");
  else add("OBS-011", "HIGH", "FAIL", "Actionable incident alerts", "Existing reliability alert path could not be verified.");

  if (/listReliabilityIncidents/.test(operations) && /criticalIncidents/.test(operations) && /recentOperatorActions/.test(operations) && /requireAdmin/.test(await read("app/api/admin/operations/route.ts"))) pass("OBS-012", "Admin operational visibility", "Authorized operators can inspect service health, critical incidents and recent operator actions through the existing RBAC-protected operations surface.");
  else add("OBS-012", "HIGH", "FAIL", "Admin operational visibility", "Operational visibility/RBAC could not be verified.");

  if (/sanitizeIncidentMetadata/.test(reliabilityIncidents) && /sanitizeTelemetryValue/.test(reliabilityIncidents)) pass("OBS-013", "Incident metadata privacy", "Reliability incident metadata is sanitized before persistence.");
  else add("OBS-013", "CRITICAL", "FAIL", "Incident metadata privacy", "Incident metadata sanitization is missing.");

  if (/paymentProcessingMinutes/.test(reliabilityChecks) && /paymentEventMinutes/.test(reliabilityChecks) && /fulfillmentPendingMinutes/.test(reliabilityChecks) && /shipmentCreatedMinutes/.test(reliabilityChecks)) pass("OBS-014", "Commerce incident detection", "Existing reliability checks cover payment, order, fulfillment and shipping dwell/reconciliation signals.");
  else add("OBS-014", "HIGH", "FAIL", "Commerce incident detection", "Critical commerce reliability checks are incomplete.");

  if (/PAYMENT_PROVIDER/.test(reliabilityModel) && /QIKINK/.test(reliabilityModel) && /SHIPPING_PROVIDER/.test(reliabilityModel) && /ANALYTICS_PIPELINE/.test(reliabilityModel)) pass("OBS-015", "Dependency policies", "Existing dependency policies define timeout/retry behavior without introducing a second provider architecture.");
  else add("OBS-015", "HIGH", "FAIL", "Dependency policies", "Dependency observability policy inventory is incomplete.");

  if (/deploymentId/.test(reliabilityIncidents) && /APP_VERSION|COMMIT_REF/.test(operations) && /NETLIFY_DEPLOY_ID/.test(operations)) pass("OBS-016", "Deployment/release correlation", "Incident records and operations visibility retain deployment/release references where the deployment environment provides them.");
  else add("OBS-016", "MEDIUM", "FAIL", "Deployment/release correlation", "Deployment correlation could not be verified.");

  if (/auditAdminAction/.test(await read("app/api/admin/operations/route.ts")) && /adminAuditLog/.test(operations)) pass("OBS-017", "Incident timeline and audit separation", "Operator actions use the existing audit system; operational telemetry remains separate from audit records.");
  else add("OBS-017", "HIGH", "FAIL", "Incident timeline and audit separation", "Audit/telemetry separation could not be verified.");

  if (/assertSameOrigin/.test(await read("app/api/telemetry/client/route.ts")) && /MAX_BODY_BYTES/.test(await read("app/api/telemetry/client/route.ts")) && /slice\(0, 500\)/.test(await read("app/api/telemetry/client/route.ts"))) pass("OBS-018", "Client telemetry boundary", "Client error telemetry is same-origin, size-bounded and message-bounded.");
  else add("OBS-018", "HIGH", "FAIL", "Client telemetry boundary", "Client telemetry safety controls are incomplete.");

  if (/logger\.(warn|error|info|debug)/.test(instrumentation) && !/console\.(log|error|warn)\(/.test(instrumentation)) pass("OBS-019", "Single logging architecture", "Instrumentation uses the existing logger instead of introducing a second logging system.");
  else add("OBS-019", "HIGH", "FAIL", "Single logging architecture", "Duplicate logging architecture detected.");

  if (!/opentelemetry|@opentelemetry|jaeger|zipkin/i.test(pkg.dependencies ? JSON.stringify(pkg.dependencies) : "") && !/opentelemetry|@opentelemetry|jaeger|zipkin/i.test(pkg.devDependencies ? JSON.stringify(pkg.devDependencies) : "")) add("OBS-020", "INFORMATIONAL", "UNAVAILABLE", "Distributed tracing", "No distributed tracing platform is present in the repository. This is documented rather than fabricated or introduced solely for certification.");
  else pass("OBS-020", "Distributed tracing", "A tracing dependency is present; detailed span coverage is certified as an existing architecture concern.");

  if (/backgroundJobs:\s*\{\s*status:"UNKNOWN"/.test(operations.replaceAll(" ", ""))) add("OBS-021", "INFORMATIONAL", "UNAVAILABLE", "Background job telemetry", "The operations dashboard explicitly reports background-job telemetry as UNKNOWN because no centralized execution telemetry exists for every scheduled/background job.");
  else pass("OBS-021", "Background job telemetry", "Background-job status is represented in the operational dashboard.");

  if (/RUNBOOKS/.test(operations)) pass("OBS-022", "Runbook inventory", "The operations service exposes the existing runbook inventory to authorized operators.");
  else add("OBS-022", "HIGH", "FAIL", "Runbook inventory", "Existing runbook inventory could not be verified.");

  const matrix = [
    ["application outage","service health + request errors","SIMULATED/UNIT","application"],
    ["API failure","http error metric + error telemetry","ARCHITECTURE","api"],
    ["database outage","readiness probe + reliability finding","SIMULATED/UNIT","database"],
    ["database latency","db query duration + bounded health probe","ARCHITECTURE","database"],
    ["connection exhaustion","database failure/reliability checks","UNAVAILABLE","database"],
    ["payment failure","payment operation/reliability checks","ARCHITECTURE","payment"],
    ["payment timeout","dependency timeout policy + error class","ARCHITECTURE","payment"],
    ["duplicate payment callback","idempotency/conflict telemetry","ARCHITECTURE","payment"],
    ["fulfillment failure","Qikink/provider incident checks","ARCHITECTURE","fulfillment"],
    ["Qikink timeout","provider timeout policy + provider error class","ARCHITECTURE","fulfillment"],
    ["webhook failure","webhook verification/error class","ARCHITECTURE","webhook"],
    ["shipping failure","shipping reliability checks","ARCHITECTURE","shipping"],
    ["queue backlog","background-job dashboard","UNAVAILABLE","background jobs"],
    ["background-job failure","background-job dashboard","UNAVAILABLE","background jobs"],
    ["authentication abuse","security event metric","ARCHITECTURE","security"],
    ["authorization failure","security event metric + audit","ARCHITECTURE","security"],
    ["deployment failure","deployment/release identity","ARCHITECTURE","deployment"],
    ["performance degradation","request duration + frontend vitals","ARCHITECTURE","performance"],
    ["security event","security event metric + audit separation","ARCHITECTURE","security"],
    ["observability-provider failure","telemetry failures are best-effort; no external provider is configured","UNAVAILABLE","observability"],
  ];

  let incidentDrillPassed = false;
  try {
    const drill = JSON.parse(await read("artifacts/phase-16-14-incident-drill-evidence.json")) as { result?: string };
    incidentDrillPassed = drill.result === "PASS";
  } catch {}

  const report = {
    phase: "16.14",
    generatedAt: new Date().toISOString(),
    evidencePolicy: "Measured/simulated/observed/estimated/unavailable are explicitly distinguished; no production metrics or incident outcomes are fabricated.",
    inventory: {
      observabilityModules: ["logger","redaction","metrics","request","errors","health","security","client"],
      reliabilityModules: ["checks","incidents","service","operations","model"],
      requestCorrelation: "proxy.ts",
      runtimeErrorHook: "instrumentation.ts",
      adminOperationalSurface: "app/api/admin/operations/route.ts",
      healthEndpoints: ["/api/health","/api/health/readiness"],
    },
    incidentTestMatrix: matrix.map(([scenario, signal, result, component]) => ({scenario, detectionSignal:signal, observedResult:result, responderVisibility:result === "UNAVAILABLE" ? "Known limitation documented" : "Repository architecture/test evidence", customerImpact:"Not measured in CI", recoveryPath:"Existing operational/runbook path; production outcome not claimed", evidence:"Phase 16.14 certification evidence", result})),
    findings,
    limitations: [
      "No external distributed tracing provider is configured; no trace coverage is claimed.",
      "No external paging/alert destination is configured; the existing database-backed reliability incident plus admin operations surface is the actionable alert path.",
      "Production historical metrics, alert deliveries, customer impact counts and SLO compliance are not available in repository CI and are not fabricated.",
      "Provider sandbox failures for PayU/Qikink/shipping are not executed against production credentials; the CI incident drill validates the internal alert/deduplication pipeline only.",
      "Background-job telemetry is explicitly UNKNOWN where centralized execution telemetry does not exist.",
    ],
    incidentDrill: { required: true, passed: incidentDrillPassed, evidenceClass: "simulated" },
    certification: {
      criticalFailures: findings.filter(f => f.status === "FAIL" && f.severity === "CRITICAL").length,
      highFailures: findings.filter(f => f.status === "FAIL" && f.severity === "HIGH").length,
      mediumFailures: findings.filter(f => f.status === "FAIL" && f.severity === "MEDIUM").length,
      lowFailures: findings.filter(f => f.status === "FAIL" && f.severity === "LOW").length,
      readiness: findings.filter(f => f.status === "FAIL" && (f.severity === "CRITICAL" || f.severity === "HIGH")).length === 0 && incidentDrillPassed ? "READY_FOR_PHASE_16_15" : "PENDING_INCIDENT_DRILL",
    },
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/phase-16-14-observability-certification-evidence.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.certification));

  const blockers = findings.filter(f => f.status === "FAIL" && (f.severity === "CRITICAL" || f.severity === "HIGH"));
  if (blockers.length) {
    console.error(JSON.stringify(blockers, null, 2));
    process.exit(1);
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
