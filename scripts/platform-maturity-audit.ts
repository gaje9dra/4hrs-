import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir: string): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "coverage"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(path));
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry.name)) result.push(path);
  }
  return result;
}

const failures: string[] = [];
const warnings: string[] = [];

const packageJson = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));

if (!existsSync(join(root, "package-lock.json"))) failures.push("package-lock.json is missing.");
if (lock.lockfileVersion !== 3) warnings.push(`Expected npm lockfileVersion 3, found ${String(lock.lockfileVersion)}.`);

const rootLock = lock.packages?.[""];
for (const section of ["dependencies", "devDependencies"] as const) {
  const declared = packageJson[section] ?? {};
  const locked = rootLock?.[section] ?? {};
  for (const [name, spec] of Object.entries(declared)) {
    if (locked[name] !== spec) failures.push(`package-lock root ${section} mismatch for ${name}: manifest=${spec}, lock=${locked[name] ?? "<missing>"}`);
  }
}

const nvm = read(".nvmrc").trim();
const netlify = read("netlify.toml");
const nodeEngine = packageJson.engines?.node;
const npmEngine = packageJson.engines?.npm;
if (nvm !== "24.21.0") failures.push(`.nvmrc must remain 24.21.0 (found ${nvm}).`);
if (!netlify.includes('NODE_VERSION = "24.21.0"')) failures.push("netlify.toml is not pinned to Node 24.21.0.");
if (!netlify.includes('NPM_VERSION = "11.6.0"')) failures.push("netlify.toml is not pinned to npm 11.6.0.");
if (nodeEngine !== ">=24.21.0 <25") failures.push(`package.json Node engine drift: ${String(nodeEngine)}`);
if (npmEngine !== ">=11.6.0 <12") failures.push(`package.json npm engine drift: ${String(npmEngine)}`);
if (packageJson.packageManager !== "npm@11.6.0") failures.push(`packageManager drift: ${String(packageJson.packageManager)}`);

const sourcePaths = walk("app").concat(walk("components"), walk("lib"), walk("netlify"), walk("scripts"));
for (const path of sourcePaths) {
  const content = read(path);
  const normalized = path.replaceAll("\\", "/");

  if (/^app\/|^components\//.test(normalized)) {
    if (/from ["'][^"']*(?:@prisma\/client|@\/lib\/db\/client|lib\/db\/client)/.test(content)) {
      failures.push(`UI-layer database coupling detected in ${normalized}`);
    }
    if (/from ["'][^"']*(?:@\/lib\/fulfillment\/providers|lib\/fulfillment\/providers)/.test(content)) {
      failures.push(`UI-layer provider coupling detected in ${normalized}`);
    }
  }

  if (/^app\/\(storefront\)|^components\/storefront\//.test(normalized) && /QIKINK|qikink/i.test(content)) {
    failures.push(`Qikink reference detected in customer-facing source ${normalized}`);
  }

  if (/^lib\//.test(normalized) && /process\.env\.NEXT_PUBLIC_(?!SITE_URL\b)/.test(content)) {
    failures.push(`Potential public secret/config exposure in server library ${normalized}`);
  }
}

const qikinkOutsideFulfillment = sourcePaths.filter((path) => {
  const normalized = path.replaceAll("\\", "/");
  return !normalized.startsWith("lib/fulfillment/") && !normalized.startsWith("netlify/");
}).filter((path) => /qikink/i.test(read(path)) && !path.startsWith("tests/"));
if (qikinkOutsideFulfillment.length) {
  warnings.push(`Qikink references exist outside the fulfillment boundary: ${qikinkOutsideFulfillment.join(", ")}`);
}

const requiredDocs = [
  "docs/phase-15-21-platform-maturity-dependency-governance.md",
  "docs/adr/0001-platform-maturity-remediations.md",
];
for (const path of requiredDocs) if (!existsSync(join(root, path))) failures.push(`Required Phase 15.21 artifact missing: ${path}`);

if (warnings.length) {
  console.warn(JSON.stringify({ status: "ok-with-warnings", warnings }, null, 2));
}
if (failures.length) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checked: {
    lockfile: true,
    runtimePins: true,
    uiDatabaseBoundary: true,
    uiProviderBoundary: true,
    serverPublicEnvBoundary: true,
    requiredDocumentation: true,
  },
  warnings,
}, null, 2));
