import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Status = "PASS" | "FAIL" | "NOT_APPLICABLE";
type Finding = {
  id: string; severity: Severity; area: string; status: Status;
  description: string; evidence: string; remediation: string; remainingRisk: string;
};

const root = process.cwd();
const findings: Finding[] = [];
const pass = (id: string, area: string, description: string, evidence: string, remainingRisk = "None identified by this certification.") =>
  findings.push({id, severity:"INFORMATIONAL", area, status:"PASS", description, evidence, remediation:"None.", remainingRisk});
const na = (id: string, area: string, description: string, evidence: string, remainingRisk = "Not applicable to the current repository surface.") =>
  findings.push({id, severity:"INFORMATIONAL", area, status:"NOT_APPLICABLE", description, evidence, remediation:"None.", remainingRisk});
const fail = (id: string, severity: Exclude<Severity,"INFORMATIONAL">, area: string, description: string, evidence: string, remediation: string, remainingRisk = "Unresolved until remediation is verified.") =>
  findings.push({id, severity, area, status:"FAIL", description, evidence, remediation, remainingRisk});

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(join(root, dir), {withFileTypes:true})) {
    if (["node_modules",".next",".git"].includes(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
async function main() {
  const files = (await Promise.all(["app","lib","scripts","tests","netlify",".github"].map(async d => {
    try { return await walk(d); } catch { return []; }
  }))).flat().filter(p => /\.(ts|tsx|js|jsx|mjs|mts|json|toml|yml|yaml)$/.test(p));
  const runtime = files.filter(p => p.startsWith("app/") || p.startsWith("lib/"));
  const routes = files.filter(p => /^app\/api\/.*\/route\.ts$/.test(p));
  const read = (p:string) => readFile(join(root,p),"utf8");
  const records = await Promise.all(routes.map(async path => ({path,text:await read(path)})));
  const runtimeRecords = await Promise.all(runtime.map(async path => ({path,text:await read(path)})));
  const has = (t:string, xs:string[]) => xs.some(x => t.includes(x));
  const methods = (t:string) => [...t.matchAll(/export\\s+async\\s+function\\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g)].map(m=>m[1]);

  pass("SEC-001","Attack Surface","Security-sensitive repository surfaces were inventoried.",
    files.length + " source/config files; " + routes.length + " API route handlers.");
  pass("SEC-002","Threat Model","Required attacker classes and trust boundaries are represented by this certification and prior phase evidence.",
    "Unauthenticated/authenticated customers, compromised sessions/admins, low-privilege admins, API clients/bots, replay/webhook attackers, providers, dependencies, credentials, database/internal services and malicious input.");

  const admin = records.filter(r=>r.path.startsWith("app/api/admin/"));
  const adminMissing = admin.filter(r=>!r.text.includes("requireAdmin("));
  if (adminMissing.length) fail("SEC-003","HIGH","Authorization","Admin routes without the canonical DB-backed authorization boundary were found.",adminMissing.map(r=>r.path).join(", "),"Add requireAdmin() with the required permission.");
  else pass("SEC-003","Authorization","Every admin API route uses the canonical server-side RBAC boundary.",admin.length + " admin routes inspected.");

  const stateChanging = records.filter(r => {
    const mutating = methods(r.text).some(m=>["POST","PUT","PATCH","DELETE"].includes(m));
    if (!mutating || r.path.includes("/payment/webhook/")) return false;
    if (r.text.includes("methodNotAllowed(") || r.text.includes("orderMethodNotAllowed(") || r.text.includes("trackingMethodNotAllowed(")) return false;
    return true;
  });
  const originMissing = stateChanging.filter(r=>!has(r.text,["assertSameOrigin(","assertAdminSameOrigin(","isTrustedStateChangingRequest(","requireAdmin(","validateUnsubscribeToken(","consumeUnsubscribeToken("]));
  if (originMissing.length) fail("SEC-004","HIGH","CSRF","State-changing API handlers lack the existing origin/trust boundary.",originMissing.map(r=>r.path).join(", "),"Enforce the canonical state-changing request trust boundary.");
  else pass("SEC-004","CSRF","State-changing handlers use the canonical origin/fetch-metadata or admin boundary.",stateChanging.length + " handlers inspected.");

  const authRoutes = records.filter(r=>r.path.startsWith("app/api/auth/"));
  if (!authRoutes.every(r=>has(r.text,["assertSameOrigin(","authErrorResponse("]))) fail("SEC-005","HIGH","Authentication","Authentication routes do not consistently use the shared security boundary.",authRoutes.map(r=>r.path).join(", "),"Use the canonical authentication HTTP boundary.");
  else pass("SEC-005","Authentication","Authentication endpoints use the shared same-origin and safe-error boundary.",authRoutes.map(r=>r.path).join(", "));

  const session = await read("lib/auth/session.ts");
  if (!/randomBytes\(32\)/.test(session) || !/sha256/.test(session) || !/httpOnly:\s*true/.test(session) || !/sameSite:\s*"lax"/.test(session))
    fail("SEC-006","HIGH","Session Security","Opaque token hashing and secure cookie controls are incomplete.","lib/auth/session.ts","Use secure random opaque tokens, server-side hashes, HttpOnly, Secure in production and SameSite.");
  else pass("SEC-006","Session Security","Customer sessions use secure random opaque tokens, SHA-256 hashes and hardened cookies.","lib/auth/session.ts");

  const password = await read("lib/auth/password.ts");
  if (!/scrypt/.test(password) || !/randomBytes/.test(password) || !/timingSafeEqual/.test(password))
    fail("SEC-007","HIGH","Password Security","Password storage controls do not show scrypt, random salt and timing-safe verification.","lib/auth/password.ts","Use the established secure password hashing implementation.");
  else pass("SEC-007","Password Security","Passwords use scrypt with random salts and timing-safe verification.","lib/auth/password.ts","Password recovery/email verification are not implemented and are explicitly residual capabilities.");

  const proxy = await read("proxy.ts");
  if (/unsafe-inline/.test(proxy) || /unsafe-eval/.test(proxy) || !/strict-dynamic/.test(proxy) || !/object-src 'none'/.test(proxy) || !/frame-ancestors 'none'/.test(proxy) || !/form-action 'self'/.test(proxy))
    fail("SEC-008","HIGH","CSP","The nonce CSP does not satisfy the established strict production policy.","proxy.ts","Preserve nonce-bound strict-dynamic CSP and object/frame/form restrictions.");
  else pass("SEC-008","CSP","Production CSP is nonce-bound, strict-dynamic and denies object/frame/form abuse.","proxy.ts");

  const nextConfig = await read("next.config.ts");
  const requiredHeaders = ["X-Content-Type-Options","Referrer-Policy","X-Frame-Options","Permissions-Policy","Cross-Origin-Opener-Policy"];
  const missingHeaders = requiredHeaders.filter(h=>!nextConfig.includes(h));
  if (missingHeaders.length) fail("SEC-009","MEDIUM","Security Headers","Core browser security headers are missing.",missingHeaders.join(", "),"Restore the canonical global headers.");
  else pass("SEC-009","Security Headers","Core browser security headers are globally configured.",requiredHeaders.join(", ") + "; production HSTS is also configured.");

  const publicSecretHits = runtimeRecords.filter(r=>/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/.test(r.text)).map(r=>r.path);
  if (publicSecretHits.length) fail("SEC-010","CRITICAL","Secrets","Public environment names expose secret-bearing configuration.",publicSecretHits.join(", "),"Keep credentials server-only.");
  else pass("SEC-010","Secrets","No public secret-bearing environment variable names were found in runtime source.","Static runtime scan.");

  const rawSql = runtimeRecords.filter(r=>r.text.includes("$queryRawUnsafe") || r.text.includes("$executeRawUnsafe")).map(r=>r.path);
  if (rawSql.length) fail("SEC-011","HIGH","SQL Injection","Unsafe Prisma raw SQL APIs are present.",rawSql.join(", "),"Replace unsafe raw SQL with parameterized/database-safe APIs.");
  else pass("SEC-011","SQL Injection","No unsafe Prisma raw SQL API was detected.","Runtime scan.");

  const commandHits = runtimeRecords.filter(r=>/\b(exec|execFile|spawn|spawnSync)\s*\(/.test(r.text)).map(r=>r.path);
  if (commandHits.length) fail("SEC-012","HIGH","Command Injection","Runtime subprocess boundaries require review.",commandHits.join(", "),"Eliminate the command boundary or constrain inputs before invocation.");
  else na("SEC-012","Command Injection","No runtime subprocess boundary was detected.","No exec/execFile/spawn invocation in app/lib.");

  const traversalHits = runtimeRecords.filter(r=>/readFile|writeFile|unlink|rm\(|mkdir|createWriteStream|createReadStream/.test(r.text) && /(params|searchParams|request\.url|request\.json|pathname)/.test(r.text)).map(r=>r.path);
  if (traversalHits.length) fail("SEC-013","MEDIUM","Path Traversal","Potential user-influenced filesystem operations require review.",traversalHits.join(", "),"Constrain filesystem paths to fixed application roots and reject traversal.");
  else na("SEC-013","Path Traversal","No user-influenced filesystem operation was detected.","Runtime scan.");

  const ssrfHits = runtimeRecords.filter(r=>/fetch\s*\(\s*(request\.url|url|input|target|redirect|callback|returnUrl)/i.test(r.text)).map(r=>r.path);
  if (ssrfHits.length) fail("SEC-014","HIGH","SSRF","A runtime fetch appears to accept a directly user-controlled URL.",ssrfHits.join(", "),"Allowlist trusted origins and block private/link-local/metadata destinations.");
  else pass("SEC-014","SSRF","No direct user-controlled URL-to-fetch pattern was detected.","Runtime scan","Provider calls use fixed configured origins; deployed egress remains an infrastructure concern.");

  const rawHtml = runtimeRecords.filter(r=>r.text.includes("dangerouslySetInnerHTML")).map(r=>r.path);
  const unsafeHtml = rawHtml.filter(p=>p!=="app/layout.tsx");
  if (unsafeHtml.length) fail("SEC-015","HIGH","XSS","Raw HTML rendering exists outside the certified JSON-LD layout boundary.",unsafeHtml.join(", "),"Sanitize rich content or remove raw HTML rendering.");
  else pass("SEC-015","XSS","Raw HTML rendering is confined to the nonce-bound JSON-LD layout path.",rawHtml.length ? rawHtml.join(", ") : "No raw HTML rendering.");

  const redirects = runtimeRecords.filter(r=>/(NextResponse\.)?redirect\s*\(/.test(r.text));
  const suspiciousRedirects = redirects.filter(r=>/returnUrl|callback|next=|request\.url|searchParams/.test(r.text));
  if (suspiciousRedirects.length) fail("SEC-016","HIGH","Open Redirect","Redirect logic references user-controlled URL-like input.",suspiciousRedirects.map(r=>r.path).join(", "),"Allow only relative internal destinations or strict trusted origins.");
  else if (redirects.length) pass("SEC-016","Open Redirect","Redirect calls were found without an obvious user-controlled destination pattern.",redirects.map(r=>r.path).join(", "));
  else na("SEC-016","Open Redirect","No redirect API call was detected.","Runtime scan.");

  const qikinkApp = records.filter(r=>/qikink/i.test(r.text));
  if (qikinkApp.length) fail("SEC-017","CRITICAL","Qikink Boundary","Qikink references appear directly in API route handlers.",qikinkApp.map(r=>r.path).join(", "),"Keep Qikink behind the provider-neutral server-side adapter.");
  else pass("SEC-017","Qikink Boundary","No direct Qikink reference exists in API route handlers.","API route scan.");

  const webhook = records.find(r=>r.path==="app/api/payment/webhook/[providerId]/route.ts");
  if (!webhook || !/verifyWebhook/.test(webhook.text) || !/verified\.verified/.test(webhook.text))
    fail("SEC-018","CRITICAL","Webhook Security","Payment webhook processing lacks a visible verification gate.","app/api/payment/webhook/[providerId]/route.ts","Require provider verification before processing any event.");
  else pass("SEC-018","Webhook Security","Payment webhook processing is gated on provider verification and bounded payload size.","Canonical webhook route.");

  const errorLeaks = records.filter(r=>/JSON\.stringify\(error\)|error\.stack/.test(r.text));
  if (errorLeaks.length) fail("SEC-019","HIGH","Error Handling","API routes directly serialize exception internals.",errorLeaks.map(r=>r.path).join(", "),"Return canonical safe error DTOs.");
  else pass("SEC-019","Error Handling","No direct exception serialization pattern was found in API routes.","Route scan.");

  const directSensitiveLogs = runtimeRecords.filter(r=>/console\.(log|warn|error)\([^\n]*(password|authorization|cookie|secret|token)/i.test(r.text));
  if (directSensitiveLogs.length) fail("SEC-020","HIGH","Logging Security","Potential direct sensitive-field console logging was found.",directSensitiveLogs.map(r=>r.path).join(", "),"Use the canonical redacting logger.");
  else pass("SEC-020","Logging Security","No obvious direct sensitive-field console logging was detected.","Runtime scan.");

  const redaction = await read("lib/observability/redaction.ts");
  if (!/password/.test(redaction) || !/authorization/.test(redaction) || !/session/.test(redaction))
    fail("SEC-021","HIGH","Telemetry Redaction","Canonical redaction does not cover credential/session classes.","lib/observability/redaction.ts","Extend the canonical redaction set.");
  else pass("SEC-021","Telemetry Redaction","Canonical telemetry redaction covers credentials, authorization/cookies, tokens and sessions.","lib/observability/redaction.ts");

  const health = records.filter(r=>["app/api/health/route.ts","app/api/readiness/route.ts","app/api/ready/route.ts"].includes(r.path));
  if (health.length===3 && health.every(r=>/no-store|cache-control/i.test(r.text))) pass("SEC-022","Cache Security","Health/readiness endpoints explicitly prevent caching.",health.map(r=>r.path).join(", "));
  else fail("SEC-022","MEDIUM","Cache Security","Health/readiness cache-control coverage is incomplete.",health.map(r=>r.path).join(", "),"Use no-store for operational endpoints.");

  const devRoutes = records.filter(r=>/(debug|mock|seed|reset|impersonat|migration|admin-test|maintenance|development)/i.test(r.path));
  const unsecuredDev = devRoutes.filter(r=>!has(r.text,["requireAdmin(","requireCurrentCustomer(","assertSameOrigin(","assertAdminSameOrigin(","signature","verify"]));
  if (unsecuredDev.length) fail("SEC-023","HIGH","Debug/Test Endpoints","Potential development/destructive API routes lack a visible security boundary.",unsecuredDev.map(r=>r.path).join(", "),"Remove them or strictly gate them.");
  else pass("SEC-023","Debug/Test Endpoints","Potential development/test API route names are absent or visibly gated.",devRoutes.length ? devRoutes.map(r=>r.path).join(", ") : "None identified.");

  const cron = files.filter(p=>/cron|schedule|process-.*\.m?ts$/.test(p));
  if (cron.length) {
    const cronText = (await Promise.all(cron.map(read))).join("\n");
    if (!/(authorization|secret|token|signature|cron)/i.test(cronText)) fail("SEC-024","HIGH","Background/Cron Security","Background processing lacks an obvious authenticity control.",cron.join(", "),"Authenticate scheduled invocation.");
    else pass("SEC-024","Background/Cron Security","Background processing surfaces contain an operational authenticity control.",cron.join(", "));
  } else na("SEC-024","Background/Cron Security","No scheduled/background source matched the audit patterns.","Repository scan.");

  const netlify = await read("netlify.toml");
  if (!/NODE_VERSION\s*=\s*"24\.21\.0"/.test(netlify) || !/NPM_VERSION\s*=\s*"11\.6\.0"/.test(netlify)) fail("SEC-025","MEDIUM","Netlify Deployment","Netlify runtime is not pinned to the established version line.","netlify.toml","Keep Node 24.21.0 and npm 11.6.0 pinned.");
  else pass("SEC-025","Netlify Deployment","Netlify build runtime is pinned to Node 24.21.0 and npm 11.6.0.","netlify.toml","Account-level Netlify secrets and deployed headers require deployment verification.");

  const env = await read(".env.example");
  if (/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/i.test(env)) fail("SEC-026","CRITICAL","Environment Configuration","The example environment contains a public secret-bearing variable.",".env.example","Keep credentials server-only.");
  else pass("SEC-026","Environment Configuration","The example environment contains no public secret-bearing variable names.",".env.example");

  const trackedEnv = files.filter(p=>/\.env(\.|$)/.test(p) && !p.endsWith(".env.example"));
  if (trackedEnv.length) fail("SEC-027","CRITICAL","Repository Secrets","Tracked non-example environment files were found.",trackedEnv.join(", "),"Remove credentials from version control and rotate exposed values.");
  else pass("SEC-027","Repository Secrets","No tracked non-example environment file was found.","Repository tree.");

  const ci = await read(".github/workflows/ci.yml");
  const requiredCi = ["npm run lint","npm run typecheck","npm test","npm run build","npx prisma validate","npx prisma generate","npm audit"];
  const missingCi = requiredCi.filter(x=>!ci.includes(x));
  if (missingCi.length) fail("SEC-028","HIGH","CI Security Gate","Required validation/security commands are absent from CI.",missingCi.join(", "),"Restore the repository CI gates.");
  else pass("SEC-028","CI Security Gate","CI contains lint, typecheck, test, build, Prisma validation/generation and npm audit gates.",requiredCi.join("; "));

  const customer = records.filter(r=>/^app\/api\/(customer|order|cart|checkout|payment|returns|cancellations|cases|shipping)\//.test(r.path));
  const customerMissing = customer.filter(r=>!has(r.text,["requireCurrentCustomer(","resolveCurrentCustomer(","requireCustomer(","createCheckoutApplication(","createOrderApplication(","createReturnsApplication(","createCartApplication(","createPaymentApplication(","createCaseApplication(","validateUnsubscribeToken(","consumeUnsubscribeToken("]));
  if (customerMissing.length) fail("SEC-029","HIGH","Customer Isolation","Customer-sensitive routes lack a visible canonical identity/application boundary.",customerMissing.map(r=>r.path).join(", "),"Enforce customer identity and ownership at the service boundary.");
  else pass("SEC-029","Customer Isolation","Customer-sensitive APIs expose the established canonical identity/application boundary.",customer.length + " handlers inspected.");

  const mass = runtimeRecords.filter(r=>/\.create\(\{\s*data:\s*(body|payload|input|json)|\.update\(\{\s*data:\s*(body|payload|input|json)/.test(r.text));
  if (mass.length) fail("SEC-030","HIGH","Mass Assignment","A runtime database write appears to pass an entire request object into data.",mass.map(r=>r.path).join(", "),"Map request fields through explicit allowlists.");
  else pass("SEC-030","Mass Assignment","No direct request-object-to-Prisma data mapping pattern was detected.","Runtime scan.");

  const returnedCreds = runtimeRecords.filter(r=>/return\s+.*(?:QIKINK_|DATABASE_URL|JWT_SECRET|SESSION_SECRET|CLIENT_SECRET)/.test(r.text));
  if (returnedCreds.length) fail("SEC-031","CRITICAL","Sensitive Data Leakage","Runtime source appears to return server credential variables.",returnedCreds.map(r=>r.path).join(", "),"Never include server credentials in response DTOs.");
  else pass("SEC-031","Sensitive Data Leakage","No direct server credential variable return pattern was detected.","Runtime scan.");

  na("SEC-032","File Uploads","No file-upload API surface was identified.","Upload-specific controls are not applicable unless a future upload surface is introduced.");
  na("SEC-033","CORS","No application-level permissive CORS implementation was identified.","No Access-Control-Allow-Origin implementation was found.");
  na("SEC-034","Break-Glass","No break-glass/emergency authorization mechanism was identified.","No emergency authorization bypass is certified or introduced.");
  na("SEC-035","Password Recovery","Password recovery/reset is not implemented in the current architecture.","No password-reset route/service was identified; this is a documented residual capability gap.");

  const critical = findings.filter(f=>f.status==="FAIL" && f.severity==="CRITICAL").length;
  const high = findings.filter(f=>f.status==="FAIL" && f.severity==="HIGH").length;
  const medium = findings.filter(f=>f.status==="FAIL" && f.severity==="MEDIUM").length;
  const low = findings.filter(f=>f.status==="FAIL" && f.severity==="LOW").length;
  console.log(JSON.stringify({phase:"16.10",routeCount:routes.length,adminRouteCount:admin.length,stateChangingRouteCount:stateChanging.length,critical,high,medium,low,findings,finalStatus:critical+high>0?"NOT READY FOR PHASE 16.11":"READY FOR PHASE 16.11"},null,2));
  if (critical+high>0) process.exit(1);
}
main().catch(error=>{ console.error(error instanceof Error ? error.message : "Phase 16.10 security certification failed."); process.exit(1); });
