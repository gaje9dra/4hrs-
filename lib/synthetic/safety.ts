import type { SyntheticMode } from "./model";

function bool(name: string): boolean {
  return /^(1|true|yes)$/i.test(process.env[name] ?? "");
}

export type SyntheticSafety = {
  allowed: boolean;
  reasons: string[];
  environment: string;
  baseUrl: string | null;
  paymentMode: "boundary" | "unsupported";
  providerMode: "disabled" | "mock" | "sandbox";
  notificationMode: "suppress" | "sink";
};

export function evaluateSyntheticSafety(mode: SyntheticMode): SyntheticSafety {
  const environment = process.env.NODE_ENV === "production" ? "PRODUCTION" : (process.env.NODE_ENV ?? "development").toUpperCase();
  const reasons: string[] = [];
  const baseUrl = process.env.SYNTHETIC_ALLOWED_BASE_URL?.trim().replace(//+$/, "") || null;
  const paymentMode = process.env.SYNTHETIC_PAYMENT_MODE === "boundary" ? "boundary" : "unsupported";
  const providerMode = ["disabled","mock","sandbox"].includes(process.env.SYNTHETIC_PROVIDER_MODE ?? "") ? (process.env.SYNTHETIC_PROVIDER_MODE as "disabled"|"mock"|"sandbox") : "disabled";
  const notificationMode = process.env.SYNTHETIC_NOTIFICATION_MODE === "sink" ? "sink" : "suppress";

  if (!bool("SYNTHETIC_MONITORING_ENABLED")) reasons.push("SYNTHETIC_MONITORING_ENABLED is not enabled.");
  if (mode === "PRODUCTION_SAFE") {
    if (environment !== "PRODUCTION") reasons.push("PRODUCTION_SAFE requires NODE_ENV=production.");
    if (!baseUrl) reasons.push("SYNTHETIC_ALLOWED_BASE_URL is required.");
    if (paymentMode !== "boundary") reasons.push("Production payment execution is unavailable; boundary mode must be explicitly configured.");
    if (providerMode === "disabled") reasons.push("Provider execution is disabled; fulfillment/provider mutation workflows remain blocked.");
    if (process.env.FULFILLMENT_PROVIDER_MODE === "live") reasons.push("Live fulfillment provider mode is incompatible with synthetic production execution.");
    if (notificationMode !== "suppress" && notificationMode !== "sink") reasons.push("Notification suppression or sink is required.");
  }
  if (mode === "MANUAL_DIAGNOSTIC" && !bool("SYNTHETIC_MANUAL_EXECUTION_ENABLED")) reasons.push("Manual synthetic execution is not enabled.");
  return { allowed: reasons.length === 0, reasons, environment, baseUrl, paymentMode, providerMode, notificationMode };
}

export function assertAllowedBaseUrl(url: string, allowedBaseUrl: string): void {
  const target = new URL(url);
  const allowed = new URL(allowedBaseUrl);
  if (target.protocol !== "https:" && target.hostname !== "localhost") throw new Error("Synthetic target must use HTTPS outside localhost.");
  if (target.origin !== allowed.origin) throw new Error("Synthetic target is outside the configured allowlist.");
}
