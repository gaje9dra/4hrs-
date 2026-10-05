import fs from "node:fs";
import path from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Finding = { severity: Severity; code: string; finding: string; evidence: string[] };

const root = process.cwd();
const findings: Finding[] = [];
const add = (severity: Severity, code: string, finding: string, evidence: string[] = []) =>
  findings.push({ severity, code, finding, evidence });

const exists = (file: string) => fs.existsSync(path.join(root, file));
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const walk = (dir: string): string[] => {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) result.push(...walk(relative));
    else result.push(relative);
  }
  return result;
};

const files = walk("");
const testFiles = files.filter((file) => file.startsWith("tests/") && file.endsWith(".test.ts"));
const testCorpus = testFiles.map((file) => read(file)).join("\n");
const sourceCorpus = files
  .filter((file) => /^(app|components|lib|scripts)\//.test(file) && /\.(ts|tsx)$/.test(file))
  .map((file) => read(file))
  .join("\n");

const requiredArtifacts = [
  "app/(storefront)/page.tsx",
  "app/(storefront)/search/page.tsx",
  "app/(storefront)/product/[slug]/page.tsx",
  "app/(storefront)/cart/page.tsx",
  "app/(storefront)/checkout/page.tsx",
  "app/(storefront)/account/orders/page.tsx",
  "app/(storefront)/track/[shipmentReference]/page.tsx",
  "app/(storefront)/account/cases/page.tsx",
  "app/api/cart/route.ts",
  "app/api/checkout/route.ts",
  "app/api/payment/route.ts",
  "app/api/payment/webhook/[providerId]/route.ts",
  "app/api/order/route.ts",
  "app/api/shipping/track/[shipmentReference]/route.ts",
  "app/api/cancellations/[cancellationReference]/route.ts",
  "app/api/returns/[returnReference]/route.ts",
  "app/api/cases/[caseReference]/route.ts",
  "lib/cart/service.ts",
  "lib/checkout/service.ts",
  "lib/payments/application.ts",
  "lib/payments/webhooks.ts",
  "lib/orders/application.ts",
  "lib/fulfillment/application.ts",
  "lib/shipping/application.ts",
  "lib/returns/application.ts",
  "lib/cases/application.ts",
  "lib/notifications/service.ts",
  "lib/fulfillment/providers/qikink.ts",
  "lib/shipping/providers/qikink.ts",
];
for (const file of requiredArtifacts) {
  if (!exists(file)) add("CRITICAL", "MISSING_ARTIFACT", `Required commerce artifact is missing: ${file}`, [file]);
}

const evidenceMatrix: Array<{
  id: string;
  label: string;
  requiredFiles: string[];
  markers: RegExp[];
}> = [
  { id: "16.2.1", label: "discovery/category/search", requiredFiles: ["tests/storefront-homepage.test.ts", "tests/storefront-listing.test.ts", "tests/storefront-search.test.ts"], markers: [/search/i, /pagination/i, /invalid/i, /unpublished|archived|unavailable/i] },
  { id: "16.2.2", label: "product/variant", requiredFiles: ["tests/storefront-product-detail.test.ts", "tests/storefront-product-detail-refinement.test.ts"], markers: [/variant/i, /invalid/i, /unavailable|archived|deleted/i, /price/i] },
  { id: "16.2.3", label: "cart", requiredFiles: ["tests/cart-domain-service.test.ts", "tests/cart-api-contract.test.ts", "tests/storefront-cart-experience.test.ts"], markers: [/increment|logical item|duplicate/i, /unauthorized|ownership/i, /quantity/i, /price|availability/i] },
  { id: "16.2.4", label: "checkout", requiredFiles: ["tests/checkout-domain.test.ts", "tests/checkout-ui.test.ts"], markers: [/price/i, /cart/i, /invalid|unavailable/i, /idempot|revision|changed/i] },
  { id: "16.2.5", label: "payment boundary", requiredFiles: ["tests/payment-domain-service.test.ts", "tests/payment-persistence.test.ts", "tests/payment-provider-adapter.test.ts"], markers: [/failed|failure/i, /duplicate|idempot/i, /signature|invalid|replay/i, /amount/i] },
  { id: "16.2.6", label: "order creation", requiredFiles: ["tests/order-creation.test.ts", "tests/order-lifecycle.test.ts"], markers: [/duplicate|concurrent|existing/i, /payment/i, /integrity|snapshot/i, /transaction|retry|Serializable/i] },
  { id: "16.2.7", label: "order visibility/ownership", requiredFiles: ["tests/customer-order-experience.test.ts", "tests/order-api-contract.test.ts"], markers: [/ownership|customer/i, /invalid|not found/i, /sensitive|provider/i] },
  { id: "16.2.8", label: "fulfillment handoff", requiredFiles: ["tests/fulfillment-domain.test.ts", "tests/provider-mapping.test.ts", "tests/qikink-provider.test.ts"], markers: [/mapping|sku/i, /duplicate|idempot|concurrent/i, /timeout|failure|retry/i, /qikink/i] },
  { id: "16.2.9", label: "fulfillment state", requiredFiles: ["tests/fulfillment-domain.test.ts", "tests/admin-fulfillment-operations.test.ts"], markers: [/transition/i, /reconcile|recovery/i, /unauthorized|admin/i] },
  { id: "16.2.10", label: "shipping handoff", requiredFiles: ["tests/shipping-application.test.ts", "tests/shipping-provider-capabilities.test.ts"], markers: [/shipment/i, /capabilit|unsupported/i, /duplicate|idempot/i] },
  { id: "16.2.11", label: "tracking", requiredFiles: ["tests/shipping-application.test.ts", "tests/shipping-retry.test.ts"], markers: [/tracking/i, /stale|unavailable|failure/i, /ownership/i] },
  { id: "16.2.12", label: "notifications", requiredFiles: ["tests/phase-15-7-notifications.test.ts"], markers: [/duplicate|idempot/i, /retry|failure|failed/i, /notification/i] },
  { id: "16.2.13", label: "cancellation", requiredFiles: ["tests/returns-cancellations-domain.test.ts"], markers: [/cancel/i, /eligible|transition/i, /idempot|permission|authorization|unauthorized/i] },
  { id: "16.2.14", label: "returns", requiredFiles: ["tests/returns-cancellations-domain.test.ts", "tests/admin-post-order-operations.test.ts"], markers: [/return/i, /quantity|eligib/i, /idempot|permission|authorization|unauthorized/i] },
  { id: "16.2.15", label: "customer cases", requiredFiles: ["tests/cases-domain.test.ts", "tests/admin-post-order-operations.test.ts"], markers: [/case/i, /transition/i, /permission|unauthorized|ownership/i] },
  { id: "16.2.16", label: "failure-mode matrix", requiredFiles: ["tests/payment-domain-service.test.ts", "tests/order-creation.test.ts", "tests/fulfillment-domain.test.ts", "tests/shipping-retry.test.ts"], markers: [/failure|failed/i, /timeout/i, /retry/i, /duplicate/i] },
  { id: "16.2.17", label: "concurrency", requiredFiles: ["tests/cart-domain-service.test.ts", "tests/payment-domain-service.test.ts", "tests/order-creation.test.ts", "tests/admin-payment-operations.test.ts"], markers: [/concurrent|parallel|race/i, /idempot/i, /transaction|lock|unique/i] },
  { id: "16.2.18", label: "refresh/retry/browser recovery", requiredFiles: ["tests/checkout-domain.test.ts", "tests/payment-domain-service.test.ts", "tests/order-creation.test.ts"], markers: [/retry|repeated|duplicate/i, /timeout|unknown/i, /idempot/i] },
  { id: "16.2.19", label: "security journey", requiredFiles: ["tests/phase-15-3-security-hardening.test.ts", "tests/customer-account-security.test.ts", "tests/cart-domain-service.test.ts", "tests/customer-order-experience.test.ts"], markers: [/unauthorized|forbidden|ownership/i, /tamper|forg|security/i, /credential|secret/i] },
  { id: "16.2.20", label: "state machines", requiredFiles: ["tests/order-lifecycle.test.ts", "tests/returns-cancellations-domain.test.ts", "tests/cases-domain.test.ts"], markers: [/transition/i, /terminal/i, /invalid/i, /concurr|retry|idempot/i] },
  { id: "16.2.21", label: "cross-domain consistency", requiredFiles: ["tests/order-creation.test.ts", "tests/fulfillment-domain.test.ts", "tests/shipping-persistence.test.ts", "tests/reconciliation.test.ts"], markers: [/order|payment|fulfillment|shipment/i, /mismatch|consisten|reconcil|authoritative/i, /integrity|constraint/i] },
  { id: "16.2.22", label: "customer error experience", requiredFiles: ["tests/checkout-ui.test.ts", "tests/customer-order-experience.test.ts", "tests/storefront-product-detail.test.ts"], markers: [/error|failure/i, /loading|empty|not.?found/i, /payment|fulfillment|tracking/i] },
  { id: "16.2.23", label: "admin visibility", requiredFiles: ["tests/admin-order-management.test.ts", "tests/admin-payment-operations.test.ts", "tests/admin-fulfillment-operations.test.ts", "tests/admin-shipping-operations.test.ts", "tests/admin-post-order-operations.test.ts"], markers: [/admin/i, /audit|observ/i, /payment|fulfillment|shipping|return|case/i] },
  { id: "16.2.24", label: "observability", requiredFiles: ["tests/phase-15-7-notifications.test.ts", "tests/reconciliation.test.ts", "tests/synthetic-monitoring.test.ts"], markers: [/correlation|request.?id|event.?id|audit|observ/i, /order|payment|fulfillment|shipment/i] },
  { id: "16.2.25", label: "reconciliation", requiredFiles: ["tests/reconciliation.test.ts", "tests/shipping-retry.test.ts"], markers: [/mismatch|reconcil/i, /payment|order|fulfillment|shipment|notification/i, /idempot|retry/i] },
];

for (const row of evidenceMatrix) {
  const missingFiles = row.requiredFiles.filter((file) => !exists(file));
  if (missingFiles.length) {
    add("HIGH", "MISSING_TEST_EVIDENCE", `${row.id} ${row.label} is missing required test evidence files.`, missingFiles);
    continue;
  }
  const corpus = row.requiredFiles.map((file) => read(file)).join("\n");
  const missingMarkers = row.markers.filter((marker) => !marker.test(corpus));
  if (missingMarkers.length) {
    add("MEDIUM", "COVERAGE_GAP", `${row.id} ${row.label} lacks explicit repository evidence for ${missingMarkers.length} required scenario classes.`, row.requiredFiles);
  }
}

const requiredCI = [
  "npm run lint",
  "npm run typecheck",
  "npm test",
  "npm run build",
  "npm run db:audit-migrations",
  "npm run recovery:validate",
];
const ci = read(".github/workflows/ci.yml");
for (const command of requiredCI) {
  if (!ci.includes(command)) add("HIGH", "CI_GATE_MISSING", `Mandatory CI gate is absent: ${command}`, [".github/workflows/ci.yml"]);
}

const qikink = exists("lib/fulfillment/providers/qikink.ts") ? read("lib/fulfillment/providers/qikink.ts") : "";
const qikinkShipping = exists("lib/shipping/providers/qikink.ts") ? read("lib/shipping/providers/qikink.ts") : "";
if (!/FulfillmentProviderAdapter/.test(qikink)) add("CRITICAL", "QIKINK_BOUNDARY", "Qikink fulfillment is not behind the provider-neutral adapter contract.", ["lib/fulfillment/providers/qikink.ts"]);
for (const marker of ["createShipment: false", "trackingLookup: false", "webhooks: false"]) {
  if (!qikinkShipping.includes(marker)) add("CRITICAL", "QIKINK_SHIPPING_BOUNDARY", `Qikink shipping capability boundary is missing: ${marker}`, ["lib/shipping/providers/qikink.ts"]);
}

const browserSourceFiles = files.filter((file) => /^(app|components)\\//.test(file) && /\\.(ts|tsx)$/.test(file));
for (const file of browserSourceFiles) {
  const content = read(file);
  const directProviderAccess = /from\\s+[\"'] [^\"']*qikink|fetch\\([^)]*qikink|https?:\\/\\/[^\\s\"']*qikink/i.test(content);
  const clientSecretExposure = /NEXT_PUBLIC_[A-Z0-9_]*QIKINK/i.test(content);
  if (directProviderAccess || clientSecretExposure) add("CRITICAL", "CLIENT_QIKINK_REFERENCE", `Browser-facing source directly references a Qikink transport or client-exposed credential: ${file}`, [file]);
}

const checkout = exists("app/api/checkout/route.ts") ? read("app/api/checkout/route.ts") : "";
if (/request\.(json|body)[\s\S]{0,2000}(amount|total|price)/i.test(checkout) && !/ignore|authoritative|server/i.test(checkout)) {
  add("HIGH", "CHECKOUT_AUTHORITY", "Checkout route appears to accept client financial values without an explicit server-authoritative boundary.", ["app/api/checkout/route.ts"]);
}

const webhook = exists("app/api/payment/webhook/[providerId]/route.ts") ? read("app/api/payment/webhook/[providerId]/route.ts") : "";
if (!/signature|verify/i.test(webhook)) add("HIGH", "PAYMENT_WEBHOOK_VERIFICATION", "Payment webhook route lacks visible signature/verification evidence.", ["app/api/payment/webhook/[providerId]/route.ts"]);

const orderService = exists("lib/orders/application.ts") ? read("lib/orders/application.ts") : "";
const fulfillmentService = exists("lib/fulfillment/application.ts") ? read("lib/fulfillment/application.ts") : "";
if (!/(existingForPayment|P2002|P2034|Serializable|unique)/i.test(orderService)) add("HIGH", "ORDER_IDEMPOTENCY", "Order application lacks visible exactly-once/idempotency evidence.", ["lib/orders/application.ts"]);
if (!/idempot/i.test(fulfillmentService)) add("HIGH", "FULFILLMENT_IDEMPOTENCY", "Fulfillment application lacks visible idempotency evidence.", ["lib/fulfillment/application.ts"]);

const refundBoundary = testCorpus.includes("REFUND_UNAVAILABLE") || sourceCorpus.includes("REFUND_UNAVAILABLE");
if (refundBoundary) add("MEDIUM", "REFUND_BOUNDARY", "Return resolution intentionally stops at the existing refund integration boundary; no uncontrolled refund execution is introduced by certification.", ["lib/returns/application.ts"]);

const counts = Object.fromEntries((["CRITICAL","HIGH","MEDIUM","LOW"] as Severity[]).map((severity) => [
  severity, findings.filter((item) => item.severity === severity).length,
])) as Record<Severity, number>;

const status = counts.CRITICAL > 0 ? "BLOCKED" : counts.HIGH > 0 ? "NOT_READY" : counts.MEDIUM > 0 ? "CERTIFICATION_REVIEW_REQUIRED" : "CERTIFIED_BASELINE";
const output = {
  phase: "16.2",
  status,
  counts,
  inventory: {
    files: files.length,
    tests: testFiles.length,
    apiRoutes: files.filter((file) => file.startsWith("app/api/")).length,
    storefrontRoutes: files.filter((file) => file.startsWith("app/(storefront)/")).length,
    adminRoutes: files.filter((file) => file.startsWith("app/admin/")).length,
  },
  evidenceMatrix: evidenceMatrix.map((row) => ({
    id: row.id,
    label: row.label,
    testFiles: row.requiredFiles,
    present: row.requiredFiles.every(exists),
  })),
  findings,
};

console.log(JSON.stringify(output, null, 2));
if (counts.CRITICAL > 0 || counts.HIGH > 0) process.exit(1);
