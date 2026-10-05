import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT APPLICABLE";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

type Finding = {
  id: string;
  domain: string;
  status: Status;
  severity: Severity;
  evidence: string[];
  risk: string;
  remediation: string;
};

const root = process.cwd();
const findings: Finding[] = [];

function read(path: string): string {
  const full = join(root, path);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}

function exists(path: string): boolean {
  return existsSync(join(root, path));
}

function allFiles(dir: string, result: string[] = []): string[] {
  const full = join(root, dir);
  if (!existsSync(full)) return result;
  for (const entry of readdirSync(full)) {
    const child = join(full, entry);
    const rel = relative(root, child).replaceAll("\\", "/");
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    if (statSync(child).isDirectory()) allFiles(rel, result);
    else result.push(rel);
  }
  return result;
}

const files = allFiles(".");
const sourceFiles = files.filter((file) => /\.(ts|tsx|js|jsx|json|prisma|md|yml|yaml)$/.test(file));
const sourceText = sourceFiles.map((file) => read(file)).join("\n");
const runtimeSourceFiles = sourceFiles.filter((file) => /^(app|lib|components)\//.test(file) && !/\.(test|spec)\.(ts|tsx)$/.test(file));
const runtimeSourceText = runtimeSourceFiles.map((file) => read(file)).join("\n");
const clientSourceFiles = sourceFiles.filter((file) => /^(components|public)\//.test(file) || (/^app\//.test(file) && /["']use client["']/.test(read(file))));

function add(
  id: string,
  domain: string,
  status: Status,
  severity: Severity,
  evidence: string[],
  risk: string,
  remediation: string,
): void {
  findings.push({ id, domain, status, severity, evidence, risk, remediation });
}

function pass(id: string, domain: string, evidence: string[]): void {
  add(id, domain, "PASS", "INFORMATIONAL", evidence, "No production risk identified by this certification item.", "None.");
}

function fail(id: string, domain: string, severity: Severity, evidence: string[], risk: string, remediation: string): void {
  add(id, domain, "FAIL", severity, evidence, risk, remediation);
}

const application = read("lib/fulfillment/application.ts");
const domain = read("lib/fulfillment/domain.ts");
const repository = read("lib/fulfillment/repository.ts");
const provider = read("lib/fulfillment/provider.ts");
const resolver = read("lib/fulfillment/resolver.ts");
const qikink = read("lib/fulfillment/providers/qikink.ts");
const qikinkAuth = read("lib/fulfillment/providers/qikink-auth.ts");
const shippingQikink = read("lib/shipping/providers/qikink.ts");
const schema = read("prisma/schema.prisma");
const packageJson = read("package.json");

const checks: Array<{
  id: string;
  domain: string;
  ok: boolean;
  evidence: string[];
  severity?: Severity;
  risk: string;
  remediation: string;
}> = [
  {
    id: "16.4.01", domain: "Canonical fulfillment architecture",
    ok: exists("lib/fulfillment/application.ts") && exists("lib/fulfillment/provider.ts") && exists("lib/fulfillment/resolver.ts") && exists("lib/fulfillment/repository.ts"),
    evidence: ["lib/fulfillment/application.ts", "lib/fulfillment/provider.ts", "lib/fulfillment/resolver.ts", "lib/fulfillment/repository.ts"],
    risk: "Missing canonical fulfillment layer would permit bypass implementations.",
    remediation: "Restore the provider-neutral fulfillment architecture.",
  },
  {
    id: "16.4.02", domain: "Qikink provider isolation",
    ok: /createQikinkFulfillmentProvider/.test(qikink) && /FulfillmentProviderAdapter/.test(qikink) && /qikinkFulfillmentProvider/.test(resolver),
    evidence: ["lib/fulfillment/providers/qikink.ts", "lib/fulfillment/resolver.ts"],
    risk: "Provider-specific behavior could leak into domain code.",
    remediation: "Keep Qikink behind the existing adapter/resolver boundary.",
  },
  {
    id: "16.4.03", domain: "Catalog ownership",
    ok: /ProductVariant.*providerMappings/.test(schema) && !runtimeSourceFiles.filter((f) => /(^|\/)catalog\//i.test(f)).some((f) => /qikink/i.test(read(f))),
    evidence: ["prisma/schema.prisma", "catalog source scan"],
    risk: "Provider catalog ownership would make storefront behavior dependent on Qikink.",
    remediation: "Keep product, variant, SKU and availability authoritative in 4HRS+.",
  },
  {
    id: "16.4.04", domain: "Explicit provider mapping",
    ok: /FulfillmentProviderMapping/.test(schema) && /@@unique\(\[variantId, providerId\]\)/.test(schema) && /@@unique\(\[providerId, providerSku\]\)/.test(schema) && /resolveProviderMapping/.test(application),
    evidence: ["prisma/schema.prisma", "lib/fulfillment/application.ts"],
    risk: "Ambiguous mapping can fulfill the wrong product or variant.",
    remediation: "Require an active, unique provider mapping and fail closed when absent.",
  },
  {
    id: "16.4.05", domain: "Fulfillment eligibility",
    ok: /status !== "CONFIRMED"/.test(domain) && /paymentStatus !== "SUCCEEDED"/.test(domain) && /paymentCompletedAt/.test(domain) && /shippingAddress/.test(domain),
    evidence: ["lib/fulfillment/domain.ts"],
    risk: "Unpaid, invalid or cancelled orders could reach the provider.",
    remediation: "Keep eligibility server-authoritative and payment-gated.",
  },
  {
    id: "16.4.06", domain: "Creation idempotency",
    ok: /getByIdempotencyKey/.test(application) && /getByOrderId/.test(application) && /Serializable/.test(application) && /@@unique\(\[?/.test(schema) && /idempotencyKey.*@unique/.test(schema),
    evidence: ["lib/fulfillment/application.ts", "lib/fulfillment/repository.ts", "prisma/schema.prisma"],
    risk: "Duplicate fulfillment records could create duplicate provider orders.",
    remediation: "Preserve database uniqueness plus serializable creation.",
  },
  {
    id: "16.4.07", domain: "Operation idempotency",
    ok: /FulfillmentOperationIdempotency/.test(schema) && /executeIdempotentOperation/.test(application) && /AMBIGUOUS/.test(application),
    evidence: ["prisma/schema.prisma", "lib/fulfillment/application.ts"],
    risk: "Retries/admin actions could repeat provider effects.",
    remediation: "Require durable operation idempotency and stop ambiguous operations.",
  },
  {
    id: "16.4.08", domain: "Unknown provider result",
    ok: /isAmbiguousProviderFailure/.test(application) && /const ambiguous = isAmbiguousProviderFailure/.test(application) && /FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED/.test(application) && /retryable = !ambiguous/.test(application),
    evidence: ["lib/fulfillment/application.ts"],
    risk: "Blind retry after provider acceptance/network loss can create duplicate fulfillment.",
    remediation: "Keep ambiguous outcomes non-retryable until reconciliation.",
  },
  {
    id: "16.4.09", domain: "Bounded retries",
    ok: /attempt < 3/.test(application) && /attempts >= 3/.test(application),
    evidence: ["lib/fulfillment/application.ts"],
    risk: "Unbounded retries can cause provider storms and duplicate effects.",
    remediation: "Keep retries bounded and observable.",
  },
  {
    id: "16.4.10", domain: "Concurrency protection",
    ok: /Serializable/.test(application) && /updateMany\(\{/.test(repository) && /expectedStatus/.test(repository),
    evidence: ["lib/fulfillment/application.ts", "lib/fulfillment/repository.ts"],
    risk: "Concurrent state changes could corrupt fulfillment state.",
    remediation: "Preserve serializable transactions and compare-and-set transitions.",
  },
  {
    id: "16.4.11", domain: "State machine",
    ok: /PENDING: \["SUBMITTED", "FAILED"\]/.test(domain) && /SUBMITTED: \["COMPLETED", "FAILED"\]/.test(domain) && /COMPLETED: \[\]/.test(domain),
    evidence: ["lib/fulfillment/domain.ts"],
    risk: "Illegal or terminal-state mutation could corrupt fulfillment lifecycle.",
    remediation: "Use the existing canonical transition matrix.",
  },
  {
    id: "16.4.12", domain: "Quantity integrity",
    ok: /Number\.isSafeInteger\(item\.quantity\)/.test(domain) && /item\.quantity < 1/.test(domain) && /mapOrderItemsToFulfillment/.test(application),
    evidence: ["lib/fulfillment/domain.ts", "lib/fulfillment/application.ts"],
    risk: "Client-manipulated or invalid quantity could reach Qikink.",
    remediation: "Derive quantity from authoritative order snapshots.",
  },
  {
    id: "16.4.13", domain: "Price/payment separation",
    ok: /orderTotal: order\.total\.toFixed\(2\)/.test(application) && /unitPrice: source\.unitPrice\.toFixed\(2\)/.test(application) && !/payment.*qikink/i.test(qikink),
    evidence: ["lib/fulfillment/application.ts", "lib/fulfillment/providers/qikink.ts"],
    risk: "Provider data must never become customer financial authority.",
    remediation: "Keep payment/order amounts outside provider state authority.",
  },
  {
    id: "16.4.14", domain: "Provider failure classification",
    ok: /PROVIDER_TIMEOUT/.test(qikink) && /PROVIDER_RATE_LIMITED/.test(qikink) && /PROVIDER_AUTHENTICATION/.test(qikink) && /PROVIDER_INVALID_RESPONSE/.test(qikink) && /PROVIDER_REJECTED/.test(qikink),
    evidence: ["lib/fulfillment/providers/qikink.ts", "lib/fulfillment/provider.ts"],
    risk: "Incorrect failure classification can trigger unsafe retries.",
    remediation: "Preserve explicit provider error categories.",
  },
  {
    id: "16.4.15", domain: "Provider response validation",
    ok: /parseResponse/.test(qikink) && /referenceFromResponse/.test(qikink) && /PROVIDER_INVALID_RESPONSE/.test(qikink),
    evidence: ["lib/fulfillment/providers/qikink.ts"],
    risk: "Malformed provider responses could create false success.",
    remediation: "Require a validated provider reference before submission is persisted.",
  },
  {
    id: "16.4.16", domain: "Qikink secret isolation",
    ok: !clientSourceFiles.some((f) => /QIKINK_(CLIENT_ID|CLIENT_SECRET|AUTH_TOKEN|SANDBOX_SECRET)/.test(read(f))) && !/NEXT_PUBLIC_.*QIKINK/i.test(runtimeSourceText),
    evidence: ["client/public source scan", "lib/fulfillment/providers/qikink-auth.ts"],
    risk: "Provider credentials in client code are a critical security boundary failure.",
    remediation: "Keep all Qikink credential access server-side.",
  },
  {
    id: "16.4.17", domain: "Credential redaction",
    ok: !/logger\.(info|warn|error|debug).*QIKINK_(CLIENT_SECRET|AUTH_TOKEN)/.test(qikinkAuth + qikink) && !/console\.(log|error|warn).*QIKINK_(CLIENT_SECRET|AUTH_TOKEN)/.test(qikinkAuth + qikink),
    evidence: ["Qikink auth/provider logging scan"],
    risk: "Secrets in logs can become durable credential leakage.",
    remediation: "Log only safe correlation and outcome metadata.",
  },
  {
    id: "16.4.18", domain: "Customer data minimization",
    ok: /recipientName/.test(qikink) && /address1/.test(qikink) && /email/.test(qikink) && !/payment.*secret/i.test(qikink),
    evidence: ["lib/fulfillment/providers/qikink.ts"],
    risk: "Unnecessary financial/internal data could be transmitted to the provider.",
    remediation: "Keep the provider payload limited to fulfillment-required data.",
  },
  {
    id: "16.4.19", domain: "Shipping boundary",
    ok: /createShipment: false/.test(shippingQikink) && /trackingLookup: false/.test(shippingQikink) && /webhooks: false/.test(shippingQikink),
    evidence: ["lib/shipping/providers/qikink.ts"],
    risk: "Fabricated shipment/tracking data would mislead customers and operations.",
    remediation: "Do not claim Qikink shipment/tracking capability until a verified machine contract exists.",
  },
  {
    id: "16.4.20", domain: "Qikink callback contract",
    ok: !/webhook|callback/i.test(qikink) || /no verified|unavailable|unsupported/i.test(qikink),
    evidence: ["lib/fulfillment/providers/qikink.ts", "no verified Qikink webhook implementation detected"],
    risk: "Invented callback behavior could accept forged provider state.",
    remediation: "Document the absent verified webhook contract; do not fabricate one.",
  },
  {
    id: "16.4.21", domain: "Status/reconciliation boundary",
    ok: /statusLookup: false/.test(qikink) && /FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED/.test(application) && /manual\/provider-side reconciliation/i.test(application),
    evidence: ["lib/fulfillment/providers/qikink.ts", "lib/fulfillment/application.ts"],
    risk: "Unknown provider state must never be silently retried.",
    remediation: "Keep unknown outcomes quarantined for controlled reconciliation/manual intervention.",
  },
  {
    id: "16.4.22", domain: "Admin/RBAC boundary",
    ok: sourceFiles.some((f) => /(^|\/)app\/(api\/admin|admin)\/.*fulfillment/i.test(f) && /requireAdmin/.test(read(f))),
    evidence: ["admin route/source scan"],
    risk: "Unprotected operational actions could trigger provider effects.",
    remediation: "Keep privileged fulfillment operations behind existing RBAC.",
  },
  {
    id: "16.4.23", domain: "Audit/observability",
    ok: /logFulfillmentObservation/.test(application) && /provider\.request\.(succeeded|failed)/.test(qikink) && /incrementMetric/.test(qikink),
    evidence: ["lib/fulfillment/application.ts", "lib/fulfillment/providers/qikink.ts", "lib/fulfillment/observability.ts"],
    risk: "Provider failures without correlation/metrics impair safe operations.",
    remediation: "Preserve structured fulfillment/provider observations.",
  },
  {
    id: "16.4.24", domain: "Database integrity",
    ok: /model Fulfillment \{[\s\S]*?orderId\s+String[^\n]*@unique/.test(schema) && /providerFulfillmentReference\s+String\?[^\n]*@unique/.test(schema) && /orderItemId\s+String[^\n]*@unique/.test(schema) && /model FulfillmentProviderMapping/.test(schema),
    evidence: ["prisma/schema.prisma"],
    risk: "Missing uniqueness constraints can permit duplicate fulfillment effects.",
    remediation: "Keep provider/order/item uniqueness enforced at the database layer.",
  },
  {
    id: "16.4.25", domain: "API provider isolation",
    ok: !sourceFiles.filter((f) => /^app\//.test(f)).some((f) => /qikink\.com|QIKINK_CLIENT|QIKINK_AUTH_TOKEN/i.test(read(f))),
    evidence: ["app route scan"],
    risk: "Browser/API routes directly coupled to Qikink could bypass the canonical service.",
    remediation: "Route fulfillment through the server-side application service only.",
  },
  {
    id: "16.4.26", domain: "Safe CI/provider testing",
    ok: /NODE_ENV.*test|CI/i.test(packageJson) && !/npm test.*qikink/i.test(packageJson),
    evidence: ["package.json", "CI architecture"],
    risk: "CI must not create uncontrolled real provider orders.",
    remediation: "Use deterministic mocks/stubs and never require live Qikink credentials in CI.",
  },
  {
    id: "16.4.27", domain: "Provider URL trust",
    ok: /https:\/\/qikink\.com/.test(qikink) && /credentials\.baseUrl/.test(qikink) && !/request\..*url|input\..*url/i.test(qikink),
    evidence: ["lib/fulfillment/providers/qikink.ts", "lib/fulfillment/providers/qikink-auth.ts"],
    risk: "Client-controlled provider endpoints could create SSRF or credential exfiltration.",
    remediation: "Keep provider endpoints fixed/trusted configuration.",
  },
  {
    id: "16.4.28", domain: "Qikink catalog separation",
    ok: !/search_from_my_products/.test(sourceFiles.filter((f) => /(^|\/)catalog\//.test(f)).map(read).join("\n")) && /providerSku/.test(application),
    evidence: ["catalog source scan", "lib/fulfillment/application.ts"],
    risk: "Provider catalog APIs must not become storefront catalog sources.",
    remediation: "Use explicit provider mapping maintained by 4HRS+.",
  },
  {
    id: "16.4.29", domain: "Cancellation interaction",
    ok: /assertOrderFulfillmentEligibility/.test(application) && /status !== "CONFIRMED"/.test(domain),
    evidence: ["lib/fulfillment/domain.ts", "lib/fulfillment/application.ts"],
    risk: "Cancelled/non-confirmed orders must not enter fulfillment.",
    remediation: "Preserve canonical order eligibility.",
  },
  {
    id: "16.4.30", domain: "Regression/validation tooling",
    ok: /npm run lint/.test(read(".github/workflows/ci.yml")) && /npm run typecheck/.test(read(".github/workflows/ci.yml")) && /npm test/.test(read(".github/workflows/ci.yml")) && /npm run build/.test(read(".github/workflows/ci.yml")) && /prisma validate/.test(read(".github/workflows/ci.yml")),
    evidence: [".github/workflows/ci.yml"],
    risk: "Certification without the complete existing CI gate is unreliable.",
    remediation: "Run and preserve the full existing validation suite.",
  },
];

for (const check of checks) {
  if (check.ok) pass(check.id, check.domain, check.evidence);
  else fail(check.id, check.domain, check.severity ?? "HIGH", check.evidence, check.risk, check.remediation);
}

const qikinkLimitations = [
  "Qikink statusLookup is explicitly false.",
  "Qikink shipping createShipment/trackingLookup/webhooks are explicitly false.",
  "No verified Qikink callback/webhook contract is implemented.",
];
for (const limitation of qikinkLimitations) {
  add("16.4-LIMITATION", "Provider capability limitation", "NOT APPLICABLE", "INFORMATIONAL", [limitation], "Automatic provider-side status/shipping verification is unavailable in the verified contract.", "Manual/provider-side reconciliation remains required; do not invent undocumented APIs.");
}

const critical = findings.filter((f) => f.status === "FAIL" && f.severity === "CRITICAL").length;
const high = findings.filter((f) => f.status === "FAIL" && f.severity === "HIGH").length;
const medium = findings.filter((f) => f.status === "FAIL" && f.severity === "MEDIUM").length;
const low = findings.filter((f) => f.status === "FAIL" && f.severity === "LOW").length;
const blocked = findings.filter((f) => f.status === "BLOCKED").length;
const passed = findings.filter((f) => f.status === "PASS").length;
const notApplicable = findings.filter((f) => f.status === "NOT APPLICABLE").length;

const decision = critical > 0 || blocked > 0 ? "BLOCKED" : high > 0 ? "NOT READY FOR PHASE 16.5" : "READY FOR PHASE 16.5";

const report = {
  phase: "16.4",
  certification: decision,
  totals: { checks: findings.length, passed, failed: findings.filter((f) => f.status === "FAIL").length, blocked, notApplicable, critical, high, medium, low },
  provider: "qikink",
  qikinkOwnership: "fulfillment-only",
  shippingCapability: { createShipment: false, trackingLookup: false, webhooks: false },
  findings,
};

console.log(JSON.stringify(report, null, 2));
if (critical > 0 || blocked > 0 || high > 0) process.exitCode = 1;
