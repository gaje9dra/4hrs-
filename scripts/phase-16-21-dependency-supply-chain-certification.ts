/* eslint-disable @typescript-eslint/no-explicit-any -- audit JSON mirrors untyped npm/GitHub metadata. */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Json = Record<string, any>;
const root = process.cwd();
const pkg: Json = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock: Json = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const lockRoot = lock.packages?.[''];
const findings: Array<{severity:string; area:string; finding:string; evidence:string}> = [];

function add(severity:string, area:string, finding:string, evidence:string) {
  findings.push({severity, area, finding, evidence});
}

if (lock.lockfileVersion !== 3) add('HIGH','lockfile','Unsupported lockfile version', String(lock.lockfileVersion));
if (!lockRoot) add('CRITICAL','lockfile','Root package entry is missing','package-lock.json packages[""] absent');

for (const section of ['dependencies','devDependencies'] as const) {
  for (const [name, spec] of Object.entries(pkg[section] ?? {})) {
    if (lockRoot?.[section]?.[name] !== spec) add('HIGH','lockfile',`package.json and lockfile disagree for ${name}`,`${section}: ${spec} vs lock root: ${lockRoot?.[section]?.[name] ?? 'missing'}`);
  }
}

const registry = execFileSync('npm',['config','get','registry'],{encoding:'utf8'}).trim();
if (registry !== 'https://registry.npmjs.org/') add('HIGH','registry','Unexpected npm registry',registry);

const sources = Object.entries(lock.packages ?? {}).filter(([p,v]:any) => p !== '' && (v.resolved?.startsWith('git') || v.resolved?.startsWith('http://') || (v.resolved && !v.resolved.startsWith('https://registry.npmjs.org/')) || v.link));
for (const [p,v] of sources as any) add('HIGH','sources',`Non-standard dependency source: ${p}`,JSON.stringify({resolved:v.resolved,link:v.link}));

const missingIntegrity = Object.entries(lock.packages ?? {}).filter(([p,v]:any) => p && v.resolved?.startsWith('https://registry.npmjs.org/') && !v.integrity);
if (missingIntegrity.length) add('HIGH','provenance',`${missingIntegrity.length} registry packages lack integrity metadata`,missingIntegrity.slice(0,10).map(([p])=>p).join(', '));

const conflicts = new Map<string, Set<string>>();
for (const [p,v] of Object.entries(lock.packages ?? {}) as any) {
  if (!p.startsWith('node_modules/')) continue;
  const name = p.slice('node_modules/'.length);
  const versions = conflicts.get(name) ?? new Set<string>();
  versions.add(v.version);
  conflicts.set(name, versions);
}
const duplicates = [...conflicts.entries()].filter(([,vs]) => vs.size > 1);
if (duplicates.length) add('INFORMATIONAL','duplicates',`${duplicates.length} package names resolve to multiple versions`,duplicates.slice(0,20).map(([n,vs])=>`${n}: ${[...vs].join(',')}`).join('; '));

const lifecycle: Array<{package:string;scripts:Json}> = [];
for (const [p,v] of Object.entries(lock.packages ?? {}) as any) {
  if (v.hasInstallScript || v.scripts) {
    const interesting = Object.fromEntries(Object.entries(v.scripts ?? {}).filter(([k]) => ['preinstall','install','postinstall','prepare','prepublish','postpublish'].includes(k)));
    if (v.hasInstallScript || Object.keys(interesting).length) lifecycle.push({package:p.replace('node_modules/',''),scripts:interesting});
  }
}
for (const x of lifecycle) add('INFORMATIONAL','install-scripts',`Lifecycle activity present for ${x.package}`,JSON.stringify(x.scripts));

const rootLifecycle = Object.fromEntries(Object.entries(pkg.scripts ?? {}).filter(([k]) => ['preinstall','install','postinstall','prepare','prepublish','postpublish'].includes(k)));
add('INFORMATIONAL','install-scripts','Root lifecycle scripts',JSON.stringify(rootLifecycle));

const scripts = pkg.scripts ?? {};
for (const [name, command] of Object.entries(scripts)) {
  if (/(rm\\s+-rf|dropdb|migrate\\s+reset|reset|delete.*production|deploy|provision-admin)/i.test(String(command))) {
    add('INFORMATIONAL','npm-scripts',`Potentially privileged/destructive script: ${name}`,String(command));
  }
}

const locks = ['yarn.lock','pnpm-lock.yaml','bun.lockb','bun.lock'];
for (const file of locks) if (existsSync(join(root,file))) add('HIGH','package-manager',`Conflicting lockfile present: ${file}`,file);

const auditRaw = (() => { try { return execFileSync('npm',['audit','--omit=dev','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); } catch (e:any) { return e.stdout?.toString() ?? '{}'; } })();
let audit: Json = {};
try { audit = JSON.parse(auditRaw); } catch {}
const meta = audit.metadata?.vulnerabilities ?? {};
for (const sev of ['critical','high','moderate','low','info']) if ((meta[sev] ?? 0) > 0) add(sev === 'critical' ? 'CRITICAL' : sev === 'high' ? 'HIGH' : sev === 'moderate' ? 'MEDIUM' : sev.toUpperCase() === 'INFO' ? 'INFORMATIONAL' : 'LOW','vulnerability',`${meta[sev]} ${sev} npm audit finding(s)`,JSON.stringify(meta));

const node = process.version;
const npm = execFileSync('npm',['--version'],{encoding:'utf8'}).trim();
const direct = Object.keys({...pkg.dependencies,...pkg.devDependencies});
const inventory = direct.map(name => {
  const entry = lock.packages?.[`node_modules/${name}`];
  return {name,spec:(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]),resolved:entry?.version ?? null,production:Boolean(pkg.dependencies?.[name]),clientServer:'requires source inspection',criticality:'requires evidence-based classification',license:entry?.license ?? 'not declared in lockfile'};
});

const criticalHigh = findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
const decision = criticalHigh.length ? 'NOT READY FOR PHASE 16.22' : 'READY FOR PHASE 16.22';

const report = {
  generatedAt:new Date().toISOString(),
  node,npm,registry,
  packageManager:pkg.packageManager,
  engines:pkg.engines,
  directDependencyInventory:inventory,
  transitivePackageCount:Object.keys(lock.packages ?? {}).filter(k=>k).length,
  duplicatePackageNames:duplicates.length,
  lifecyclePackageCount:lifecycle.length,
  findings,
  auditMetadata:meta,
  decision
};
writeFileSync(join(root,'artifacts-phase-16-21.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({node,npm,registry,directDependencies:direct.length,transitivePackages:report.transitivePackageCount,duplicatePackageNames:duplicates.length,lifecyclePackageCount:lifecycle.length,audit:meta,criticalHigh:criticalHigh.length,decision},null,2));
if (criticalHigh.length) process.exit(1);
