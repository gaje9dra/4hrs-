const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export type FulfillmentProviderConfiguration = Readonly<{
  id: string; enabled: boolean; mode: "test" | "live"; secretReference: string | null;
  timeoutMs: number; capabilities: Readonly<Record<string, boolean>>;
}>;
export type FulfillmentProviderConfigurationSource = Partial<{
  providerId: string; enabled: string; mode: string; secretReference: string; timeoutMs: string;
}>;
function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (/^(1|true)$/i.test(value)) return true;
  if (/^(0|false)$/i.test(value)) return false;
  throw new Error("Fulfillment provider enabled flag must be true or false.");
}
function mode(value: string | undefined): "test" | "live" {
  if (value === undefined || value === "test") return "test";
  if (value === "live") return "live";
  throw new Error("Fulfillment provider mode must be test or live.");
}
function timeout(value: string | undefined): number {
  if (value === undefined) return 10000;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1000 || parsed > 120000) {
    throw new Error("Fulfillment provider timeout must be an integer from 1000 to 120000 ms.");
  }
  return parsed;
}
export function loadFulfillmentProviderConfiguration(
  source: FulfillmentProviderConfigurationSource = {
    providerId: process.env.FULFILLMENT_PROVIDER_ID ?? "qikink",
    enabled: process.env.FULFILLMENT_PROVIDER_ENABLED,
    mode: process.env.FULFILLMENT_PROVIDER_MODE,
    secretReference: process.env.FULFILLMENT_PROVIDER_SECRET_REFERENCE ?? "QIKINK_CLIENT_SECRET",
    timeoutMs: process.env.FULFILLMENT_PROVIDER_TIMEOUT_MS,
  },
): FulfillmentProviderConfiguration | null {
  const rawId = source.providerId?.trim() ?? "";
  if (!rawId) return null;
  const id = rawId.toLowerCase();
  if (!PROVIDER_ID_PATTERN.test(id)) throw new Error("Fulfillment provider id is invalid.");
  return {
    id, enabled: bool(source.enabled, false), mode: mode(source.mode),
    secretReference: source.secretReference?.trim() || null,
    timeoutMs: timeout(source.timeoutMs), capabilities: {},
  };
}
export function assertPrivateFulfillmentConfiguration(config: FulfillmentProviderConfiguration): void {
  if (config.secretReference && /^NEXT_PUBLIC_/i.test(config.secretReference)) {
    throw new Error("Private fulfillment configuration cannot use a NEXT_PUBLIC_ environment reference.");
  }
}