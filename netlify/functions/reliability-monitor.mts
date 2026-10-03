import type { Config } from "@netlify/functions";
import { runReliabilityChecks } from "../../lib/reliability/checks";
import { recordReliabilityFindings } from "../../lib/reliability/service";
import { logger } from "../../lib/observability/logger";

export default async function reliabilityMonitor(): Promise<Response> {
  const startedAt = Date.now();
  try {
    const findings = await runReliabilityChecks();
    await recordReliabilityFindings(findings);
    logger.info("reliability.monitor_completed", {
      durationMs: Date.now() - startedAt,
      outcome: "success",
    }, {
      findings: findings.length,
      critical: findings.filter((item) => item.severity === "CRITICAL").length,
      major: findings.filter((item) => item.severity === "MAJOR").length,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error("reliability.monitor_failed", { durationMs: Date.now() - startedAt, outcome: "failure" }, {
      error: error instanceof Error ? error.name : "unknown",
    });
    return new Response(null, { status: 500 });
  }
}

export const config: Config = { schedule: "*/5 * * * *" };
