export const COST_RESOURCE_CATEGORIES = [
  "INFRASTRUCTURE","DATABASE","COMPUTE","STORAGE","BANDWIDTH","CDN","SEARCH","OBSERVABILITY",
  "EMAIL","SMS","ANALYTICS","PAYMENT_PROCESSING","FULFILLMENT","SHIPPING","BUILD_AND_DEPLOYMENT",
  "THIRD_PARTY_API","SUPPORT_OPERATIONS",
] as const;
export type CostResourceCategory = typeof COST_RESOURCE_CATEGORIES[number];

export const COST_STATUSES = ["ACTUAL","ESTIMATED","ALLOCATED","PROJECTED","UNKNOWN"] as const;
export type CostMeasurementStatus = typeof COST_STATUSES[number];

export type CapacityEvaluation = {
  triggered: boolean;
  severity: string;
  action: string;
  escalationPath: string;
};

export function classifyCostStatus(input: {
  providerBillingAvailable: boolean;
  measured: boolean;
  allocationBasis?: boolean;
  projectionBasis?: boolean;
}): CostMeasurementStatus {
  if (input.measured && input.providerBillingAvailable) return "ACTUAL";
  if (input.allocationBasis) return "ALLOCATED";
  if (input.projectionBasis) return "PROJECTED";
  if (input.measured) return "ESTIMATED";
  return "UNKNOWN";
}

export function evaluateCapacity(value: number, threshold: number, severity: string, action: string, escalationPath: string): CapacityEvaluation {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold < 0) throw new Error("Capacity values must be finite and non-negative.");
  return { triggered: value >= threshold, severity: severity.trim().slice(0,32), action: action.trim().slice(0,1000), escalationPath: escalationPath.trim().slice(0,500) };
}

export function detectAnomaly(observed: number, baseline: number, minimumAbsoluteDeviation = 0): { anomalous: boolean; deviation: number } {
  if (![observed, baseline, minimumAbsoluteDeviation].every(Number.isFinite) || minimumAbsoluteDeviation < 0) throw new Error("Anomaly inputs must be finite.");
  const deviation = observed - baseline;
  return { anomalous: Math.abs(deviation) >= minimumAbsoluteDeviation, deviation };
}

export function sanitizeMetricMetadata(value: unknown): Record<string, unknown> {
  const walk = (input: unknown, depth = 0): unknown => {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number") return Number.isFinite(input) ? input : "[NON_FINITE]";
    if (depth >= 4) return "[TRUNCATED]";
    if (Array.isArray(input)) return input.slice(0,20).map((v) => walk(v, depth + 1));
    if (typeof input === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input).slice(0,30)) {
        if (/password|token|secret|api.?key|authorization|cookie|credential|payment|email|phone|address|name/i.test(key)) continue;
        out[key] = walk(value, depth + 1);
      }
      return out;
    }
    return String(input);
  };
  return (walk(value) as Record<string, unknown>) ?? {};
}
