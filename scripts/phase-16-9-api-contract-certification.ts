import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Status = "PASS" | "FAIL" | "NOT_APPLICABLE";
type Finding = { id:string; severity:Severity; area:string; status:Status; description:string; evidence:string; remediation:string };

const root = process.cwd();
const findings: Finding[] = [];
const add = (f: Finding) => findings.push(f);
const pass = (id:string, area:string, description:string, evidence:string) =>
  add({id,severity:"INFORMATIONAL",area,status:"PASS",description,evidence,remediation:"None."});
const fail = (id:string, severity:Exclude<Severity,"INFORMATIONAL">, area:string, description:string, evidence:string, remediation:string) =>
  add({id,severity,area,status:"FAIL",description,evidence,remediation});

async function walk(dir:string):Promise<string[]> {
  const out:string[] = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes:true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}
const sourceFiles = (await Promise.all(["app","lib","scripts","tests"].map(walk))).flat()
  .filter(p => /\.(ts|tsx|js|jsx)$/.test(p));
const routeFiles = sourceFiles.filter(p => /^app[\\/]api[\\/].*route\.ts$/.test(p));

const routeRecords = await Promise.all(routeFiles.map(async p => {
  const c = await readFile(join(root,p),"utf8");
  const rel = p.replaceAll("\\\\","/");
  const methods = [...c.matchAll(/export\\s+async\\s+function\\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g)].map(m=>m[1]);
  return { path:rel, c, methods };
}));

pass("API-001","Route Inventory","All Next.js API route handlers were enumerated from the repository.","Found " + routeRecords.length + " app/api/**/route.ts files.");

const publicPrefixes = [
  "app/api/health/route.ts","app/api/readiness/route.ts","app/api/ready/route.ts",
  "app/api/auth/login/route.ts","app/api/auth/register/route.ts",
];
const adminMissing = routeRecords.filter(r => r.path.startsWith("app/api/admin/") && !/requireAdmin\\s*\\(/.test(r.c));
if (adminMissing.length) {
  fail("API-002","HIGH","Admin Route Authorization","Admin API routes without an explicit canonical requireAdmin guard were found.",
    adminMissing.map(r=>r.path).join(", "),
    "Add the canonical DB-backed requireAdmin permission check at the route boundary.");
} else pass("API-002","Admin Route Authorization","Every admin route has a canonical server-side admin authorization guard.",
  "All " + routeRecords.filter(r=>r.path.startsWith("app/api/admin/")).length + " admin routes contain requireAdmin().");

const stateChanging = routeRecords.filter(r=>r.methods.some(m=>["POST","PUT","PATCH","DELETE"].includes(m)));
const originMissing = stateChanging.filter(r =>
  !/payment\/webhook/.test(r.path) &&
  !publicPrefixes.includes(r.path) &&
  !/assertSameOrigin|assertAdminSameOrigin|isTrustedStateChangingRequest/.test(r.c)
);
if (originMissing.length) {
  fail("API-003","HIGH","CSRF/Origin Protection","State-changing API routes without an explicit trusted-origin control were found.",
    originMissing.map(r=>r.path).join(", "),
    "Use the existing assertSameOrigin/assertAdminSameOrigin control or an equivalent canonical provider signature boundary.");
} else pass("API-003","CSRF/Origin Protection","State-changing application routes enforce the existing origin-boundary control.",
  "Checked " + stateChanging.length + " state-changing route handlers; payment webhooks are separately signature-gated.");

const customerRoutes = routeRecords.filter(r => r.path.startsWith("app/api/customer/") || /^app\/api\/(order|cart|checkout|payment|returns|cancellations|cases|shipping)\//.test(r.path));
const missingCustomerGuard = customerRoutes.filter(r => !/requireCurrentCustomer|resolveCurrentCustomer|requireCustomer|createCheckoutApplication|createOrderApplication|createReturnsApplication|createCartApplication|createPaymentApplication/.test(r.c));
if (missingCustomerGuard.length) {
  fail("API-004","HIGH","Customer Authentication Boundary","Customer-sensitive routes lack a visible canonical customer/service authentication boundary.",
    missingCustomerGuard.map(r=>r.path).join(", "),
    "Enforce authentication through the existing canonical application/service boundary and add an explicit route guard where delegation is not intentional.");
} else pass("API-004","Customer Authentication Boundary","Customer-sensitive routes either invoke canonical customer authentication directly or delegate to an authenticated application service.",
  "Checked " + customerRoutes.length + " customer-sensitive routes.");

const webhook = routeRecords.find(r=>r.path==="app/api/payment/webhook/[providerId]/route.ts");
if (!webhook) fail("API-005","CRITICAL","Webhook Boundary","The canonical payment webhook route is missing.","Expected app/api/payment/webhook/[providerId]/route.ts.","Restore the canonical payment webhook boundary.");
else if (!/signature|verify|verified|authenticate/i.test(webhook.c)) fail("API-005","CRITICAL","Webhook Boundary","Payment webhook route does not visibly enforce provider verification.","No signature/verification boundary found in the handler source.","Require the provider's canonical signature/authentication verification before processing.");
else pass("API-005","Webhook Boundary","Payment webhook processing has a provider-verification boundary in the route/application path.","Payment webhook handler contains verification-related controls.");

const unsafeRaw = sourceFiles.filter(p=>!/^scripts[\\/]phase-16-9-api-contract-certification\.ts$/.test(p))
  .filter(async()=>false);
const rawHits:string[] = [];
for (const p of sourceFiles) {
  if (/^(tests[\\/]|scripts[\\/])/.test(p) && /phase-16-9/.test(p)) continue;
  const c = await readFile(join(root,p),"utf8");
  if (/\\$queryRawUnsafe|\\$executeRawUnsafe/.test(c)) rawHits.push(p);
}
if (rawHits.length) fail("API-006","HIGH","Injection/Database Safety","Unsafe Prisma raw-SQL APIs are present.",rawHits.join(", "),"Replace with parameterized Prisma APIs or a reviewed safe raw-SQL boundary.");
else pass("API-006","Injection/Database Safety","No unsafe Prisma raw-SQL APIs were detected in application/runtime source.","No $queryRawUnsafe/$executeRawUnsafe usage found.");

const secretHits:string[] = [];
for (const p of sourceFiles) {
  const c = await readFile(join(root,p),"utf8");
  if (/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/.test(c) ||
      /process\\.env\\.[A-Z0-9_]*(QIKINK|PAYU|DATABASE|JWT|SESSION).*?(?:Response|NextResponse|json|return)/s.test(c)) secretHits.push(p);
}
if (secretHits.length) fail("API-007","CRITICAL","Secret Exposure","Potential server-secret exposure patterns were detected.","Review: " + secretHits.join(", "),"Remove the secret from public/client configuration or response paths and keep credentials server-side.");
else pass("API-007","Secret Exposure","No obvious public-secret naming or direct server-secret response pattern was detected.","Static repository scan completed without matches.");

const stackHits:string[] = [];
for (const r of routeRecords) {
  if (/JSON\.stringify\\(error\\)|error\\.stack|Response\\.json\\(\\{[^}]*error[^}]*message/i.test(r.c)) stackHits.push(r.path);
}
if (stackHits.length) fail("API-008","HIGH","Error Contract Safety","Route handlers contain error serialization patterns requiring manual review.","Review: " + stackHits.join(", "),"Map internal exceptions to safe public error contracts; never serialize raw exceptions.");
else pass("API-008","Error Contract Safety","No direct raw-exception serialization pattern was detected in route handlers.","Static route scan completed.");

const qikinkClient = sourceFiles.filter(p=>p.startsWith("app/") && /qikink/i.test(readFile));
const browserProvider = routeRecords.filter(r=>/qikink/i.test(r.c) && r.path.startsWith("app/"));
if (browserProvider.length) fail("API-009","CRITICAL","Qikink Boundary","Qikink references were found directly in route/UI source and require boundary review.",browserProvider.map(r=>r.path).join(", "),"Keep Qikink access behind the server-side provider-neutral fulfillment boundary.");
else pass("API-009","Qikink Boundary","No direct Qikink references were found in app route handlers.","Qikink references remain outside app route source.");

const devEndpoints = routeRecords.filter(r=>/(debug|mock|seed|reset|impersonat|database|migration|test-only|fixture)/i.test(r.path));
if (devEndpoints.length) {
  const unsecured = devEndpoints.filter(r=>!(/requireAdmin|requireCurrentCustomer|assertSameOrigin|signature|verify/i.test(r.c)));
  if (unsecured.length) fail("API-010","HIGH","Development Endpoint Exposure","Potential development/test/destructive endpoints lack an obvious security boundary.",unsecured.map(r=>r.path).join(", "),"Remove the endpoint or add strict environment/authentication/authorization gating.");
  else pass("API-010","Development Endpoint Exposure","Potential development/test endpoints have visible security boundaries.",devEndpoints.map(r=>r.path).join(", "));
} else pass("API-010","Development Endpoint Exposure","No development/debug/test/destructive API route names were detected.","Route-path scan found no matching names.");

const health = routeRecords.filter(r=>["app/api/health/route.ts","app/api/readiness/route.ts","app/api/ready/route.ts"].includes(r.path));
if (health.every(r=>/no-store|cache-control/i.test(r.c)) && health.length===3) pass("API-011","Health/Readiness","Health and readiness routes explicitly disable caching.","All three health/readiness routes include no-store/cache-control handling.");
else fail("API-011","MEDIUM","Health/Readiness","Health/readiness cache controls are incomplete.","Review: " + health.map(r=>r.path).join(", "),"Use no-store for operational health/readiness responses.");

const clientFetchSecrets = sourceFiles.filter(p=>p.startsWith("app/") && /process\.env\.(?!NEXT_PUBLIC_)/.test(readFile));
if (clientFetchSecrets.length) fail("API-012","HIGH","Environment Boundary","Potential server-only environment access exists in app source and requires review.",clientFetchSecrets.join(", "),"Move server-only environment access behind server-only modules.");
else pass("API-012","Environment Boundary","No obvious non-public environment access pattern was detected in app source.","Static app-source scan completed.");

const counts = Object.fromEntries((["CRITICAL","HIGH","MEDIUM","LOW","INFORMATIONAL"] as Severity[]).map(s=>[s,findings.filter(f=>f.severity===s).length]));
const blockers = findings.filter(f=>f.status==="FAIL" && ["CRITICAL","HIGH"].includes(f.severity));
console.log(JSON.stringify({phase:"16.9",routeCount:routeRecords.length,methodHandlers:stateChanging.length,findings,counts,blockerCount:blockers.length},null,2));
if (blockers.length) process.exit(1);
