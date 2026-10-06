import { readFile } from "node:fs/promises";

const path = "docs/phase-16-19-release-deployment-certification.md";
const document = await readFile(path, "utf8");

const required = [
  "## 1. Phase objective",
  "## 3. Repository/deployment architecture discovered",
  "## 4. Actual CI/CD architecture",
  "## 10. Netlify deployment configuration",
  "## 11. Database migration process",
  "## 12. Startup/readiness behavior",
  "## 16. Rollback architecture",
  "## 17. Recovery architecture",
  "## 21. Test matrix",
  "## 25. Blocker classification",
  "## 26. CI results",
  "## 27. Production deployment readiness assessment",
  "## 28. Final certification decision",
  "**NOT READY FOR PHASE 16.20**",
];

const missing = required.filter((token) => !document.includes(token));
if (missing.length) {
  throw new Error(`Phase 16.19 certification document is incomplete: ${missing.join(", ")}`);
}

if (document.includes("BEGIN PHASE 16.20") || document.includes("START PHASE 16.20")) {
  throw new Error("Phase 16.20 work must not be introduced by Phase 16.19.");
}

console.log(JSON.stringify({
  phase: "16.19",
  status: "PASS",
  finalDecision: "NOT READY FOR PHASE 16.20",
  requiredSections: required.length,
}));
