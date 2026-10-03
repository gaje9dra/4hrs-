import { createHash } from "node:crypto";
import { sanitizeTelemetryValue } from "@/lib/observability/redaction";

export type ReliabilitySeverity = "CRITICAL" | "MAJOR" | "OPERATIONAL" | "LOCALIZED" | "INFO";
export type ReliabilityCategory =
  | "AVAILABILITY" | "FINANCIAL" | "DATA_PRIVACY" | "PROVIDER"
  | "OPERATIONS" | "SECURITY" | "PERFORMANCE" | "DEPENDENCY" | "DATA_INTEGRITY";

export type ReliabilityFinding = Readonly<{
  fingerprint: string;
  severity: ReliabilitySeverity;
  category: ReliabilityCategory;
  capability: string;
  title: string;
  summary: string;
  dependency?: string;
  metadata?: Record<string, unknown>;
}>;

export type IncidentImpact = Readonly<{
  customerImpact: "NONE" | "LOCALIZED" | "MAJOR" | "WIDESPREAD";
  financialImpact: "NONE" | "POTENTIAL" | "CONFIRMED";
  dataIntegrity: "NONE" | "POTENTIAL" | "CONFIRMED";
  privacy: "NONE" | "POTENTIAL" | "CONFIRMED";
  operationalScope: "SINGLE_RESOURCE" | "WORKFLOW" | "SYSTEM";
  durationMinutes?: number;
}>;

export function classifyIncidentSeverity(impact: IncidentImpact): ReliabilitySeverity {
  if (impact.privacy === "CONFIRMED" || impact.dataIntegrity === "CONFIRMED" && impact.customerImpact === "WIDESPREAD") return "CRITICAL";
  if (impact.financialImpact === "CONFIRMED" && impact.customerImpact !== "NONE") return "CRITICAL";
  if (impact.customerImpact === "WIDESPREAD" || impact.dataIntegrity === "CONFIRMED") return "CRITICAL";
  if (impact.customerImpact === "MAJOR" || impact.operationalScope === "SYSTEM") return "MAJOR";
  if (impact.financialImpact === "POTENTIAL" || impact.privacy === "POTENTIAL" || impact.operationalScope === "WORKFLOW") return "OPERATIONAL";
  if (impact.customerImpact === "LOCALIZED" || impact.operationalScope === "SINGLE_RESOURCE") return "LOCALIZED";
  return "INFO";
}

export function incidentFingerprint(capability: string, category: ReliabilityCategory, signal: string, dependency?: string): string {
  return createHash("sha256")
    .update([capability, category, dependency ?? "none", signal].join("\0"))
    .digest("hex")
    .slice(0, 32);
}

export function shouldEmitAlert(now: Date, lastAlertedAt: Date | null, cooldownMs = 15 * 60_000): boolean {
  return !lastAlertedAt || now.getTime() - lastAlertedAt.getTime() >= cooldownMs;
}

export function sanitizeIncidentMetadata(metadata: unknown): Record<string, unknown> {
  const value = sanitizeTelemetryValue(metadata);
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
