import { readServerEnvironment, validateServerEnvironment } from "@/lib/config/env";
import { loadPaymentProviderConfiguration } from "@/lib/payments/config";
import { loadFulfillmentProviderConfiguration } from "@/lib/fulfillment/config";
import { readFile } from "node:fs/promises";

type EnvSnapshot = Record<string, string | undefined>;
function snapshot(names: string[]): EnvSnapshot { return Object.fromEntries(names.map((name) => [name, process.env[name]])); }
function restore(values: EnvSnapshot): void { for (const [name, value] of Object.entries(values)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }
function expectFailure(label: string, fn: () => unknown): void { try { fn(); } catch { return; } throw new Error(`Expected configuration validation failure: ${label}`); }
function setEnv(name: string, value: string): void { Reflect.set(process.env, name, value); }

async function main(): Promise<void> {
  const document = await readFile("docs/phase-16-20-production-configuration-certification.md", "utf8");
  const envExample = await readFile(".env.example", "utf8");
  const sections = ["## 1. Phase objective","## 2. Configuration architecture","## 5. Environment-variable inventory","## 7. Secret-management analysis","## 11. Payment configuration","## 12. Qikink configuration","## 15. Netlify configuration","## 16. CI configuration","## 20. Security configuration","## 21. Observability configuration","## 36. Configuration drift","## 38. Configuration matrix","## 39. Failure matrix","## 42. CI results","## 43. Final certification decision","**NOT READY FOR PHASE 16.21**"];
  for (const section of sections) if (!document.includes(section)) throw new Error(`Missing Phase 16.20 certification section: ${section}`);
  const templateVars = ["NEXT_PUBLIC_SITE_URL","DATABASE_URL","PAYMENT_PROVIDER_ID","PAYMENT_PROVIDER_ENABLED","PAYMENT_PROVIDER_MODE","PAYMENT_PROVIDER_SECRET_REFERENCE","PAYMENT_PROVIDER_WEBHOOK_SECRET_REFERENCE","FULFILLMENT_PROVIDER_ID","FULFILLMENT_PROVIDER_ENABLED","FULFILLMENT_PROVIDER_MODE","QIKINK_CLIENT_ID","QIKINK_CLIENT_SECRET","NOTIFICATION_PROVIDER_ENABLED","NOTIFICATION_PROVIDER_ID","NOTIFICATION_UNSUBSCRIBE_SECRET"];
  for (const variable of templateVars) if (!envExample.includes(`${variable}=`)) throw new Error(`.env.example is missing ${variable}`);
  const envNames = ["NODE_ENV","DATABASE_URL","NEXT_PUBLIC_SITE_URL","FULFILLMENT_PROVIDER_ID","FULFILLMENT_PROVIDER_ENABLED","FULFILLMENT_PROVIDER_MODE","FULFILLMENT_PROVIDER_SECRET_REFERENCE","QIKINK_CLIENT_ID","QIKINK_CLIENT_SECRET","QIKINK_SANDBOX_SECRET","QIKINK_AUTH_TOKEN","FULFILLMENT_PROVIDER_TIMEOUT_MS","PAYMENT_PROVIDER_ID","PAYMENT_PROVIDER_ENABLED","PAYMENT_PROVIDER_MODE","PAYMENT_PROVIDER_PUBLIC_KEY","PAYMENT_PROVIDER_SECRET_REFERENCE","PAYMENT_PROVIDER_WEBHOOK_SECRET_REFERENCE","PAYMENT_PROVIDER_TIMEOUT_MS","PAYMENT_SANDBOX_WEBHOOK_SECRET","NOTIFICATION_PROVIDER_ENABLED","NOTIFICATION_PROVIDER_ID","NOTIFICATION_PROVIDER_MODE","NOTIFICATION_PROVIDER_TIMEOUT_MS","NOTIFICATION_UNSUBSCRIBE_SECRET"];
  const saved = snapshot(envNames);
  try {
    setEnv("NODE_ENV", "production"); process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/app"; process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example";
    process.env.FULFILLMENT_PROVIDER_ID = "qikink"; process.env.FULFILLMENT_PROVIDER_ENABLED = "true"; process.env.FULFILLMENT_PROVIDER_MODE = "test"; process.env.FULFILLMENT_PROVIDER_SECRET_REFERENCE = "QIKINK_CLIENT_SECRET"; process.env.QIKINK_CLIENT_SECRET = "placeholder";
    expectFailure("production fulfillment cannot run in test mode", () => validateServerEnvironment());
    process.env.FULFILLMENT_PROVIDER_MODE = "live"; delete process.env.QIKINK_CLIENT_SECRET;
    expectFailure("live production fulfillment requires its server-side credential", () => validateServerEnvironment());
    process.env.FULFILLMENT_PROVIDER_ENABLED = "false"; process.env.PAYMENT_PROVIDER_ID = "controlled-sandbox"; process.env.PAYMENT_PROVIDER_ENABLED = "true"; process.env.PAYMENT_PROVIDER_MODE = "test";
    expectFailure("controlled sandbox cannot be enabled in production", () => validateServerEnvironment());
    process.env.PAYMENT_PROVIDER_MODE = "live"; expectFailure("controlled sandbox cannot run as a production live provider", () => validateServerEnvironment());
    process.env.PAYMENT_PROVIDER_ENABLED = "false"; process.env.NEXT_PUBLIC_SITE_URL = "http://shop.example"; expectFailure("production site URL must use HTTPS", () => validateServerEnvironment());
    process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example"; process.env.DATABASE_URL = "mysql://user:pass@example.invalid:3306/app"; expectFailure("non-PostgreSQL DATABASE_URL is rejected", () => validateServerEnvironment());
    process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/app"; process.env.FULFILLMENT_PROVIDER_SECRET_REFERENCE = "NEXT_PUBLIC_BAD_SECRET"; expectFailure("server-only fulfillment secret references cannot use NEXT_PUBLIC_", () => validateServerEnvironment());
    process.env.FULFILLMENT_PROVIDER_SECRET_REFERENCE = "QIKINK_CLIENT_SECRET"; process.env.FULFILLMENT_PROVIDER_ENABLED = "false"; process.env.PAYMENT_PROVIDER_ENABLED = "false"; setEnv("NODE_ENV", "test"); process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
    validateServerEnvironment();
    process.env.FULFILLMENT_PROVIDER_ENABLED = "maybe"; expectFailure("malformed fulfillment enabled flag is rejected", () => loadFulfillmentProviderConfiguration());
    process.env.FULFILLMENT_PROVIDER_ENABLED = "false"; process.env.FULFILLMENT_PROVIDER_MODE = "invalid"; expectFailure("malformed fulfillment mode is rejected", () => loadFulfillmentProviderConfiguration());
    process.env.FULFILLMENT_PROVIDER_MODE = "test"; process.env.FULFILLMENT_PROVIDER_TIMEOUT_MS = "not-a-number"; expectFailure("malformed fulfillment timeout is rejected", () => loadFulfillmentProviderConfiguration());
    process.env.FULFILLMENT_PROVIDER_TIMEOUT_MS = "10000"; process.env.PAYMENT_PROVIDER_ID = "controlled-sandbox"; process.env.PAYMENT_PROVIDER_ENABLED = "maybe"; expectFailure("malformed payment enabled flag is rejected", () => loadPaymentProviderConfiguration());
    process.env.PAYMENT_PROVIDER_ENABLED = "false"; process.env.PAYMENT_PROVIDER_MODE = "invalid"; expectFailure("malformed payment mode is rejected", () => loadPaymentProviderConfiguration());
    process.env.PAYMENT_PROVIDER_MODE = "test"; process.env.PAYMENT_PROVIDER_TIMEOUT_MS = "0"; expectFailure("malformed payment timeout is rejected", () => loadPaymentProviderConfiguration());
    process.env.PAYMENT_PROVIDER_TIMEOUT_MS = "10000";
    const fulfillment = loadFulfillmentProviderConfiguration(); const payment = loadPaymentProviderConfiguration();
  } finally { restore(saved); }
  if (/(?:sk_live_|sk_test_|-----BEGIN .*PRIVATE KEY-----|AKIA[0-9A-Z]{16})/.test(envExample)) throw new Error("Credential-shaped secret material exists in .env.example.");
  const savedRuntime = snapshot(["NODE_ENV","DATABASE_URL","NEXT_PUBLIC_SITE_URL","APP_VERSION"]);
  let runtimeEnvironment: string;
  try { setEnv("NODE_ENV", "production"); process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/app"; process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example"; process.env.APP_VERSION = "ci"; runtimeEnvironment = readServerEnvironment().nodeEnv; } finally { restore(savedRuntime); }
  console.log(JSON.stringify({ phase: "16.20", status: "PASS", configurationValidation: "PASS", environmentValidation: "PASS", productionRuntimeValidation: "PASS", runtimeEnvironment, finalDecision: "NOT READY FOR PHASE 16.21" }));
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });