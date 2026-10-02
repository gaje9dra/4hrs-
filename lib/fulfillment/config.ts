const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export type FulfillmentProviderConfiguration = Readonly<{
  id: string;
  enabled: boolean;
  mode: "test" | "live";
  secretReference: string | null;
  timeoutMs: number;
  capabilities: Readonly<Record<string, boolean>>;
}>;

export type FulfillmentProviderConfigurationSource = Partial<{
  providerId: string;
  enabled: string;
  mode: string;
  secretReference: string;
  timeoutMs: string;
}>;

function bool(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : /^(1|true)$/i.test(value);
}

function timeout(value: string | undefined): number {
  const parsed = value === undefined ? 10000 : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1000 && parsed <= 120000 ? parsed : 10000;
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
  const id = source.providerId?.trim().toLowerCase() ?? "";
  if (!id || !PROVIDER_ID_PATTERN.test(id)) return null;
  return {
    id,
    enabled: bool(source.enabled, false),
    mode: source.mode === "live" ? "live" : "test",
    secretReference: source.secretReference?.trim() || null,
    timeoutMs: timeout(source.timeoutMs),
    capabilities: {},
  };
}

export function assertPrivateFulfillmentConfiguration(config: FulfillmentProviderConfiguration): void {
  if (config.secretReference && /^NEXT_PUBLIC_/i.test(config.secretReference)) {
    throw new Error("Private fulfillment configuration cannot use a NEXT_PUBLIC_ environment reference.");
  }
}
