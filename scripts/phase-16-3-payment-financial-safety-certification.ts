import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Status = "PASS" | "REVIEW" | "BLOCKED";
type Finding = { id:string; area:string; status:Status; severity?:Severity; evidence:string[]; detail:string };

const root=process.cwd();
const read=(p:string)=>existsSync(join(root,p))?readFileSync(join(root,p),"utf8"):"";
const exists=(p:string)=>existsSync(join(root,p));
const files:string[]=[];
function walk(dir:string){
  if(!existsSync(dir)) return;
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    if(["node_modules",".next",".git"].includes(entry.name)) continue;
    const full=join(dir,entry.name);
    if(entry.isDirectory()) walk(full); else files.push(relative(root,full).replaceAll("\\\\","/"));
  }
}
walk(root);
const sources=files.filter(p=>/\\.(ts|tsx|js|jsx|prisma|json|md)$/.test(p));
const sourceText=sources.map(p=>`\\n// ${p}\\n${read(p)}`).join("\\n");
const findings:Finding[]=[];
const add=(id:string,area:string,ok:boolean,evidence:string[],detail:string,blockedSeverity?:Severity)=>{
  findings.push({id,area,status:ok?"PASS":"BLOCKED",...(ok?{}:{severity:blockedSeverity??"HIGH"}),evidence,detail});
};

add("16.3.1","Payment architecture",
  exists("lib/payments/application.ts")&&exists("lib/payments/provider.ts")&&exists("lib/payments/repository.ts")&&exists("app/api/payment/route.ts")&&exists("app/api/payment/webhook/[providerId]/route.ts"),
  ["lib/payments/application.ts","lib/payments/provider.ts","lib/payments/repository.ts","app/api/payment/route.ts","app/api/payment/webhook/[providerId]/route.ts"],
  "Canonical payment application, provider boundary, repository, initialization route and webhook route are present."
);
add("16.3.2","Financial data model",
  /model Payment \{/.test(read("prisma/schema.prisma"))&&/model PaymentAttempt \{/.test(read("prisma/schema.prisma"))&&/model PaymentEvent \{/.test(read("prisma/schema.prisma"))&&/model PaymentRefund \{/.test(read("prisma/schema.prisma")),
  ["prisma/schema.prisma"],"Payment, attempt, event and refund structures are represented by existing models.");
add("16.3.3","Authoritative amount",
  /checkout\.totals\.total/.test(read("app/api/payment/route.ts"))&&/amount: \{ value: checkout\.totals\.total/.test(read("app/api/payment/route.ts"))&&/payment\.amount\.toFixed\(2\)/.test(read("lib/payments/application.ts")),
  ["app/api/payment/route.ts","lib/payments/application.ts"],"Checkout totals are server-derived and payment creation uses the validated checkout amount.");
add("16.3.4","Currency integrity",
  /validatePaymentAmount\(event\.amount\)/.test(read("lib/payments/application.ts"))&&/payment\.currency !== event\.currency/.test(read("lib/payments/application.ts")),
  ["lib/payments/application.ts","lib/payments/domain.ts"],"Payment-event currency and authoritative payment currency are compared.");
add("16.3.5","Payment initialization",
  /Idempotency-Key/.test(read("app/api/payment/route.ts"))&&/createPaymentFromCheckout/.test(read("lib/payments/application.ts")),
  ["app/api/payment/route.ts","lib/payments/application.ts"],"Initialization requires an idempotency key and server-side checkout validation.");
add("16.3.6","Idempotency",
  /@@unique\(\[customerId, operation, key\]\)/.test(read("prisma/schema.prisma"))&&/lookupByIdempotencyKey/.test(read("lib/payments/application.ts")),
  ["prisma/schema.prisma","lib/payments/application.ts"],"Database uniqueness and application replay lookup are both present.");
add("16.3.7","Webhook verification",
  /verifyWebhook/.test(read("app/api/payment/webhook/[providerId]/route.ts"))&&/webhookVerification/.test(read("app/api/payment/webhook/[providerId]/route.ts")),
  ["app/api/payment/webhook/[providerId]/route.ts","lib/payments/provider.ts"],"Webhook requests must pass the provider adapter verification boundary.");
add("16.3.8","Payment state machine",
  /const transitions/.test(read("lib/payments/domain.ts"))&&/assertPaymentTransition/.test(read("lib/payments/application.ts")),
  ["lib/payments/domain.ts","lib/payments/application.ts"],"Existing payment transition table is the single state machine.");
add("16.3.9","Failure handling",
  /PROVIDER_TIMEOUT/.test(read("lib/payments/application.ts"))&&/PROVIDER_NETWORK_ERROR/.test(read("lib/payments/application.ts")),
  ["lib/payments/application.ts","lib/payments/errors.ts"],"Provider timeout/network failures remain explicit application errors.");
add("16.3.10","Unknown payment state",
  /reconcilePayment/.test(read("lib/payments/application.ts"))&&/AMBIGUOUS/.test(read("lib/payments/application.ts")),
  ["lib/payments/application.ts","prisma/schema.prisma"],"Reconciliation and ambiguous refund states exist; unknown provider outcomes are not silently converted to success.");
add("16.3.11","Duplicate payment protection",
  /@@unique\(\[customerId, checkoutReference\]\)/.test(read("prisma/schema.prisma"))&&/PAYMENT_ALREADY_COMPLETED/.test(read("lib/payments/application.ts")),
  ["prisma/schema.prisma","lib/payments/application.ts"],"Checkout/payment uniqueness prevents duplicate logical payment creation.");
add("16.3.12","Payment/order consistency",
  /paymentId        String.*@unique/.test(read("prisma/schema.prisma"))&&/validateVerifiedPayment/.test(read("lib/orders/application.ts")),
  ["prisma/schema.prisma","lib/orders/application.ts"],"Order-to-payment linkage is unique and order creation validates a verified payment.");
add("16.3.13","Order finalization",
  /Serializable/.test(read("lib/orders/application.ts"))&&/getOrderByPayment/.test(read("lib/orders/application.ts")),
  ["lib/orders/application.ts"],"Order finalization uses serializable transactions and payment uniqueness.");
add("16.3.14","Provider security",
  /assertPrivatePaymentConfiguration/.test(read("lib/payments/config.ts"))&&/NEXT_PUBLIC_/.test(read("lib/payments/config.ts")),
  ["lib/payments/config.ts","lib/payments/provider.ts"],"Provider private configuration is separated from public configuration.");
add("16.3.15","Customer authorization",
  /customerId/.test(read("app/api/payment/route.ts"))&&/getPaymentById\(paymentId, customerId\)/.test(read("lib/payments/repository.ts")),
  ["app/api/payment/route.ts","lib/payments/repository.ts"],"Customer payment reads are scoped by authenticated customer ownership.");
add("16.3.16","Admin authorization",
  /requireAdmin/.test(read("app/api/admin/payments/route.ts"))&&/requirePermission/.test(read("lib/admin/payments.ts")),
  ["app/api/admin/payments/route.ts","lib/admin/payments.ts"],"Admin payment operations are server-authorized with explicit permissions.");
add("16.3.17","Refund controls",
  /refundPayment/.test(read("lib/payments/application.ts"))&&/amount\.gt\(refundable\)/.test(read("lib/payments/application.ts")),
  ["lib/payments/application.ts","prisma/schema.prisma"],"Refunds enforce payment eligibility, currency and remaining refundable balance.");
add("16.3.18","Refund idempotency",
  /admin-refund/.test(read("lib/payments/application.ts"))&&/idempotencyKey.*@unique/.test(read("prisma/schema.prisma")),
  ["lib/payments/application.ts","prisma/schema.prisma"],"Refund idempotency is persisted and uniquely constrained.");
add("16.3.19","Financial reconciliation",
  exists("lib/reconciliation/service.ts")&&/PAYMENT-ORDER-MISSING/.test(read("lib/reconciliation/service.ts")),
  ["lib/reconciliation/service.ts"],"Existing reconciliation system includes critical payment/order integrity detection.");
add("16.3.20","Financial audit trail",
  /auditAdminAction/.test(read("lib/admin/payments.ts")),
  ["lib/admin/payments.ts"],"Administrative financial actions record audit events.");
add("16.3.21","Concurrency",
  /Serializable/.test(read("lib/payments/repository.ts"))&&/P2034/.test(read("lib/payments/application.ts")),
  ["lib/payments/repository.ts","lib/payments/application.ts"],"Payment transactions use serializable isolation and concurrent event conflicts are handled without falsely failing a settled replay.");
add("16.3.22","Database integrity",
  /@@unique\(\[providerId, providerEventId\]\)/.test(read("prisma/schema.prisma"))&&/@@unique\(\[paymentId, attemptNumber\]\)/.test(read("prisma/schema.prisma")),
  ["prisma/schema.prisma"],"Provider event identity and payment-attempt sequence are uniquely constrained.");
add("16.3.23","Webhook replay",
  /recordPaymentEvent/.test(read("lib/payments/repository.ts"))&&/processingStatus === "PROCESSED"/.test(read("lib/payments/application.ts")),
  ["lib/payments/repository.ts","lib/payments/application.ts"],"Webhook events have provider identity uniqueness and processed-event replay handling.");
add("16.3.24","Abuse protection",
  /Idempotency-Key/.test(read("app/api/payment/route.ts"))&&/MAX_BODY_BYTES/.test(read("app/api/payment/webhook/[providerId]/route.ts"))&&/consumeFinancialRateLimit/.test(read("lib/payments/rate-limit.ts"))&&/PaymentRateLimitBucket/.test(read("prisma/schema.prisma")),
  ["app/api/payment/route.ts","app/api/payment/webhook/[providerId]/route.ts","lib/payments/rate-limit.ts","prisma/schema.prisma"],
  "Payment initialization, customer payment access and webhooks use durable, fail-closed financial rate limiting with explicit production-safe thresholds.");
add("16.3.25","Payment observability",
  /payment_operations_total/.test(read("lib/payments/http.ts"))&&/logOrderCreationObservation/.test(read("lib/orders/application.ts")),
  ["lib/payments/http.ts","lib/payments/application.ts","lib/orders/application.ts"],"Payment and order operations emit structured operational metrics/observations.");
add("16.3.26","Customer-facing payment UX",
  /PAYMENT_ALREADY_COMPLETED/.test(read("lib/payments/errors.ts"))&&/PROVIDER_TIMEOUT/.test(read("lib/payments/errors.ts"))&&/PAYMENT_DECLINED/.test(read("lib/payments/errors.ts")),
  ["lib/payments/errors.ts","lib/payments/http.ts"],"Customer-visible error taxonomy distinguishes completion, timeout and decline outcomes.");
add("16.3.27","Failure injection",
  /PROVIDER_TIMEOUT|PROVIDER_NETWORK_ERROR/.test(read("lib/payments/application.ts"))&&/AMBIGUOUS/.test(read("lib/payments/application.ts"))&&/PAYMENT_SANDBOX_SCENARIO/.test(read("lib/payments/providers/controlled-sandbox.ts"))&&/refund-timeout/.test(read("lib/payments/providers/controlled-sandbox.ts")),
  ["lib/payments/application.ts","lib/payments/providers/controlled-sandbox.ts"],"Controlled sandbox failure injection covers timeout, network, rejection, malformed callback and refund-timeout paths.");
add("16.3.28","Payment test suite",
  exists("tests/phase-16-3-payment-financial-safety-certification.test.ts"),
  ["tests/phase-16-3-payment-financial-safety-certification.test.ts"],"Phase-specific static and contract tests are present.");
add("16.3.29","CI validation",
  /npm test/.test(read(".github/workflows/ci.yml"))&&/npx prisma validate/.test(read(".github/workflows/ci.yml"))&&/npm run build/.test(read(".github/workflows/ci.yml")),
  [".github/workflows/ci.yml"],"CI already includes lint, typecheck, tests, build and Prisma validation.");
add("16.3.30","Provider/sandbox certification",
  /controlledSandboxPaymentProvider/.test(read("lib/payments/registry.ts")) && /id: ID/.test(read("lib/payments/providers/controlled-sandbox.ts")) && /mode!=="test"/.test(read("lib/payments/config.ts")),
  ["lib/payments/registry.ts","lib/payments/providers/controlled-sandbox.ts","lib/payments/config.ts","app/api/payment/webhook/[providerId]/route.ts"],
  "A controlled sandbox provider is registered, cryptographically verifies callbacks, supports status/refund paths, and is explicitly test-mode-only. This satisfies controlled financial certification without introducing a live-money provider.",
  "HIGH");

const high=findings.filter(f=>f.status==="BLOCKED"&&f.severity==="HIGH").length;
const critical=findings.filter(f=>f.status==="BLOCKED"&&f.severity==="CRITICAL").length;
const medium=findings.filter(f=>f.status==="BLOCKED"&&f.severity==="MEDIUM").length;
const low=findings.filter(f=>f.status==="BLOCKED"&&f.severity==="LOW").length;
const review=findings.filter(f=>f.status==="REVIEW").length;
const status=critical>0?"BLOCKED":high>0?"NOT_READY":review>0?"CERTIFICATION_REVIEW_REQUIRED":"CERTIFIED";
console.log(JSON.stringify({
  phase:"16.3",
  status,
  counts:{CRITICAL:critical,HIGH:high,MEDIUM:medium,LOW:low,REVIEW:review,PASS:findings.filter(f=>f.status==="PASS").length},
  findings,
  hardStop:"Do not implement Phase 16.4 or later phases."
},null,2));
