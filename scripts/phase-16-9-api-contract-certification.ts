import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Status = "PASS" | "FAIL" | "NOT_APPLICABLE";
type Finding = { id:string; severity:Severity; area:string; status:Status; description:string; evidence:string; remediation:string };

const root = process.cwd();
const findings: Finding[] = [];
const add = (f:Finding) => findings.push(f);
const pass = (id:string, area:string, description:string, evidence:string) =>
  add({id,severity:"INFORMATIONAL",area,status:"PASS",description,evidence,remediation:"None."});
const fail = (id:string, severity:"CRITICAL"|"HIGH"|"MEDIUM"|"LOW", area:string, description:string, evidence:string, remediation:string) =>
  add({id,severity,area,status:"FAIL",description,evidence,remediation});

async function walk(dir:string):Promise<string[]> {
  const out:string[] = [];
  for (const entry of await readdir(join(root,dir),{withFileTypes:true})) {
    const p = join(dir,entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const files=(await Promise.all(["app","lib","scripts","tests"].map(walk))).flat()
  .filter(p => /\.(ts|tsx|js|jsx)$/.test(p));
const routes = files.filter(p => /^app\/api\/.*\/route\.ts$/.test(p));
const records = await Promise.all(routes.map(async path => ({
  path,
  text: await readFile(join(root,path),"utf8")
})));

const methods = (text:string) => [...text.matchAll(/export\\s+async\\s+function\\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g)].map(m=>m[1]);
const hasAny=(text:string, needles:string[]) => needles.some(n=>text.includes(n));

pass("API-001","Route Inventory","The repository API surface was enumerated from app/api route handlers.",
  records.length + " route handlers discovered.");

const admin = records.filter(r=>r.path.startsWith("app/api/admin/"));
const adminMissing = admin.filter(r=>!r.text.includes("requireAdmin("));
if(adminMissing.length) fail("API-002","HIGH","Admin Authorization","Admin routes without the canonical requireAdmin boundary were found.",
  adminMissing.map(r=>r.path).join(", "),"Add DB-backed requireAdmin authorization at the route boundary.");
else pass("API-002","Admin Authorization","Every admin route contains the canonical requireAdmin authorization boundary.",
  admin.length + " admin routes inspected.");

const stateChanging=records.filter(r=>methods(r.text).some(m=>["POST","PUT","PATCH","DELETE"].includes(m)));
const publicState=["app/api/auth/login/route.ts","app/api/auth/register/route.ts"];
const originMissing=stateChanging.filter(r =>
  !r.path.includes("/payment/webhook/") &&
  !publicState.includes(r.path) &&
  !hasAny(r.text,["assertSameOrigin(","assertAdminSameOrigin(","isTrustedStateChangingRequest("])
);
if(originMissing.length) fail("API-003","HIGH","CSRF/Origin","State-changing routes without the existing origin/trust boundary were found.",
  originMissing.map(r=>r.path).join(", "),"Use the canonical origin protection; provider webhooks must use provider verification.");
else pass("API-003","CSRF/Origin","State-changing routes use the existing origin/trust boundary or are provider webhooks.",
  stateChanging.length + " state-changing handlers inspected.");

const customer=records.filter(r=>r.path.startsWith("app/api/customer/") ||
  /^app\/api\/(order|cart|checkout|payment|returns|cancellations|cases|shipping)\//.test(r.path));
const customerMissing=customer.filter(r=>!hasAny(r.text,[
  "requireCurrentCustomer(","resolveCurrentCustomer(","requireCustomer(","createCheckoutApplication(","createOrderApplication(","createReturnsApplication(","createCartApplication(","createPaymentApplication("
]));
if(customerMissing.length) fail("API-004","HIGH","Customer Authentication","Customer-sensitive routes lack a visible canonical authentication/service boundary.",
  customerMissing.map(r=>r.path).join(", "),"Enforce authentication through the canonical customer/application service.");
else pass("API-004","Customer Authentication","Customer-sensitive routes use the canonical customer authentication/application boundary.",
  customer.length + " customer-sensitive handlers inspected.");

const webhook=records.find(r=>r.path==="app/api/payment/webhook/[providerId]/route.ts");
if(!webhook) fail("API-005","CRITICAL","Webhook Verification","The canonical payment webhook route is missing.",
  "Expected app/api/payment/webhook/[providerId]/route.ts.","Restore the canonical webhook boundary.");
else if(!hasAny(webhook.text,["verify","signature","verified","authenticate"]))
  fail("API-005","CRITICAL","Webhook Verification","The payment webhook route has no visible provider-verification control.",
    "No verification keyword found in the handler source.","Require provider signature/authentication verification before processing.");
else pass("API-005","Webhook Verification","The payment webhook path contains a provider-verification boundary.",
  "Verification-related implementation is present in the route/application path.");

const rawHits:string[]=[];
for(const p of files){
  if(p.includes("phase-16-9-api-contract-certification.ts")) continue;
  const text=await readFile(join(root,p),"utf8");
  if(text.includes("$queryRawUnsafe") || text.includes("$executeRawUnsafe")) rawHits.push(p);
}
if(rawHits.length) fail("API-006","HIGH","Injection Protection","Unsafe Prisma raw-SQL APIs are present.",
  rawHits.join(", "),"Replace unsafe raw SQL with parameterized database-safe APIs.");
else pass("API-006","Injection Protection","No unsafe Prisma raw-SQL APIs were detected.","Repository scan found no $queryRawUnsafe/$executeRawUnsafe usage.");

const secretHits:string[]=[];
for(const p of files){
  const text=await readFile(join(root,p),"utf8");
  if(/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/.test(text)) secretHits.push(p);
}
if(secretHits.length) fail("API-007","CRITICAL","Secret Exposure","Potential public-secret configuration names were detected.",
  secretHits.join(", "),"Keep credentials in server-only environment variables.");
else pass("API-007","Secret Exposure","No public environment variable names matching secret/token/password/private/API-key patterns were detected.","Static repository scan completed.");

const stackHits=records.filter(r=>r.text.includes("error.stack") || r.text.includes("JSON.stringify(error)"));
if(stackHits.length) fail("API-008","HIGH","Error Contracts","Routes contain direct exception serialization patterns requiring remediation.",
  stackHits.map(r=>r.path).join(", "),"Return canonical safe error DTOs; never expose raw exception details.");
else pass("API-008","Error Contracts","No direct error.stack or JSON.stringify(error) pattern was found in route handlers.","Static route scan completed.");

const qikinkRoutes=records.filter(r=>r.path.startsWith("app/") && r.text.toLowerCase().includes("qikink"));
if(qikinkRoutes.length) fail("API-009","CRITICAL","Qikink Boundary","Qikink references are present directly in app route source.",
  qikinkRoutes.map(r=>r.path).join(", "),"Keep Qikink access server-side behind the provider-neutral fulfillment adapter.");
else pass("API-009","Qikink Boundary","No direct Qikink references were found in app route handlers.","App route source is provider-neutral.");

const dev=records.filter(r=>/(debug|mock|seed|reset|impersonat|database|migration|test-only|fixture)/i.test(r.path));
const devUnsecured=dev.filter(r=>!hasAny(r.text,["requireAdmin(","requireCurrentCustomer(","assertSameOrigin(","assertAdminSameOrigin(","signature","verify"]));
if(devUnsecured.length) fail("API-010","HIGH","Development Endpoint Exposure","Potential development/destructive routes lack an obvious security boundary.",
  devUnsecured.map(r=>r.path).join(", "),"Remove or strictly gate the endpoint.");
else pass("API-010","Development Endpoint Exposure","Potential development/test endpoint names are either absent or visibly gated.",
  dev.length ? dev.map(r=>r.path).join(", ") : "No matching route names.");

const health=records.filter(r=>["app/api/health/route.ts","app/api/readiness/route.ts","app/api/ready/route.ts"].includes(r.path));
if(health.length===3 && health.every(r=>r.text.includes("no-store") || r.text.includes("cache-control")))
  pass("API-011","Health/Readiness","Health/readiness responses explicitly disable caching.","All three operational endpoints inspected.");
else fail("API-011","MEDIUM","Health/Readiness","Health/readiness cache-control coverage is incomplete.",
  health.map(r=>r.path).join(", "),"Use no-store for operational health/readiness responses.");

const appEnv:string[]=[];
for(const p of files.filter(p=>p.startsWith("app/"))){
  const text=await readFile(join(root,p),"utf8");
  if(/process\.env\.(?!NEXT_PUBLIC_)/.test(text)) appEnv.push(p);
}
if(appEnv.length) fail("API-012","HIGH","Environment Boundary","App source contains direct non-public environment access requiring review.",
  appEnv.join(", "),"Keep server-only environment access in server-only modules.");
else pass("API-012","Environment Boundary","No direct non-public process.env access was detected in app source.","Static app-source scan completed.");

const critical=findings.filter(f=>f.status==="FAIL" && f.severity==="CRITICAL").length;
const high=findings.filter(f=>f.status==="FAIL" && f.severity==="HIGH").length;
const medium=findings.filter(f=>f.status==="FAIL" && f.severity==="MEDIUM").length;
const low=findings.filter(f=>f.status==="FAIL" && f.severity==="LOW").length;
console.log(JSON.stringify({phase:"16.9",routeCount:records.length,critical,high,medium,low,findings},null,2));
if(critical+high>0) process.exit(1);
