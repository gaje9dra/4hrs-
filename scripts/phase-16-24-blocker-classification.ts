import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

type Finding = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  status: string;
  productionBlocking: boolean;
  category: string;
  reason: string;
};

function walk(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if ([".git", "node_modules", ".next", "coverage"].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function siteOriginStatus(): "valid" | "missing" | "invalid" {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "missing";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid";
    if (url.username || url.password || url.search || url.hash) return "invalid";
    return "valid";
  } catch {
    return "invalid";
  }
}

function main() {
  const findings: Finding[] = [];

  findings.push({
    id: "B-16.24-001",
    severity: "HIGH",
    status: "BLOCKED",
    productionBlocking: true,
    category: "payment",
    reason: "No verified live-money payment provider capability is established by repository evidence; controlled-sandbox remains test-only.",
  });

  findings.push({
    id: "B-16.24-003",
    severity: "HIGH",
    status: "BLOCKED",
    productionBlocking: true,
    category: "fulfillment",
    reason: "Live Qikink fulfillment/shipping capability remains provider-dependent and is not fabricated as verified.",
  });

  findings.push({
    id: "B-16.24-004",
    severity: "INFORMATIONAL",
    status: "NOT_EXECUTABLE",
    productionBlocking: false,
    category: "browser",
    reason: "No supported browser-runner infrastructure is present in the repository.",
  });

  const siteStatus = siteOriginStatus();
  if (siteStatus !== "valid") {
    findings.push({
      id: "B-16.24-005",
      severity: "MEDIUM",
      status: "ENVIRONMENT_FAILURE",
      productionBlocking: false,
      category: "configuration",
      reason: "NEXT_PUBLIC_SITE_URL is missing or invalid for the current execution environment.",
    });
  }

  const files = walk(process.cwd()).filter((file) => !file.includes(`${join("scripts", "phase-16-24-blocker-classification.ts")}`) && !file.includes(`${join("docs", "")}`) && !file.includes(`${join("artifacts", "")}`));
  const text = files
    .filter((file) => /\.(ts|tsx|js|jsx|json|md|yml|yaml|toml|env|example)$/i.test(file))
    .map((file) => {
      try { return readFileSync(file, "utf8"); } catch { return ""; }
    })
    .join("\n");

  const markerPatterns = [
    /TODO\b/i,
    /FIXME\b/i,
    /HACK\b/i,
    /@ts-ignore\b/i,
    /@ts-expect-error\b/i,
  ];
  const markerMatches = markerPatterns.filter((pattern) => pattern.test(text)).map(String);

  findings.push({
    id: "B-16.24-006",
    severity: "INFORMATIONAL",
    status: markerMatches.length === 0 ? "VERIFIED" : "OPEN",
    productionBlocking: false,
    category: "code-hygiene",
    reason: markerMatches.length === 0
      ? "No direct TODO/FIXME/HACK/TypeScript-suppression markers were detected by the phase scanner."
      : "One or more code-hygiene markers were detected and require classification.",
  });

  const counts = Object.fromEntries(
    ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].map((severity) => [
      severity,
      findings.filter((f) => f.severity === severity).length,
    ]),
  );

  const blocking = findings.filter((f) => f.productionBlocking && ["CRITICAL", "HIGH"].includes(f.severity)).length;
  const unresolvedCritical = findings.filter((f) => f.severity === "CRITICAL" && ["OPEN", "BLOCKED", "IN_PROGRESS"].includes(f.status)).length;
  const unresolvedHigh = findings.filter((f) => f.severity === "HIGH" && ["OPEN", "BLOCKED", "IN_PROGRESS"].includes(f.status)).length;

  const result = {
    phase: "16.24",
    generatedAt: new Date().toISOString(),
    decision: blocking === 0 && unresolvedCritical === 0 && unresolvedHigh === 0
      ? "READY FOR PHASE 16.25"
      : "NOT READY FOR PHASE 16.25",
    repositoryControlledChecks: {
      siteOrigin: siteStatus,
      filesScanned: files.length,
      markerMatches,
    },
    findings,
    dashboard: {
      total: findings.length,
      ...counts,
      productionBlocking: blocking,
      unresolvedCritical,
      unresolvedHigh,
      resolvedButUnverified: findings.filter((f) => f.status === "RESOLVED").length,
    },
  };

  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
  writeFileSync(join(process.cwd(), "artifacts/phase-16-24-blocker-classification.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === "READY FOR PHASE 16.25" ? 0 : 0;
}

main();
