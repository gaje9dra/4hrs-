export type EnvironmentName = "development" | "test" | "preview" | "production";

export type ServerEnvironment = Readonly<{
  nodeEnv: EnvironmentName;
  siteUrl: string | null;
  databaseUrl: string;
  directUrl: string | null;
  appVersion: string;
  commitSha: string | null;
  deployId: string | null;
  deployContext: string | null;
}>;

const URL_ENV_PATTERN = /^https:\/\//;

function nonEmpty(name: string, value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function environmentName(value: string | undefined): EnvironmentName {
  if (value === "production" || value === "preview" || value === "test") return value;
  return "development";
}

function requireDatabaseUrl(value = process.env.DATABASE_URL): string {
  const normalized = nonEmpty("DATABASE_URL", value);
  if (!normalized) throw new Error("DATABASE_URL is required.");
  try {
    const url = new URL(normalized);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("unsupported protocol");
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  return normalized;
}

function productionSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const normalized = nonEmpty("NEXT_PUBLIC_SITE_URL", value);
  if (!normalized) throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
  if (!URL_ENV_PATTERN.test(normalized)) throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  try {
    const url = new URL(normalized);
    if (url.username || url.password) throw new Error("credentials are not permitted");
    return url.origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid public HTTPS URL.");
  }
}

export function readServerEnvironment(): ServerEnvironment {
  const nodeEnv = environmentName(process.env.NODE_ENV);
  const databaseUrl = requireDatabaseUrl();
  const siteUrl = nodeEnv === "production" ? productionSiteUrl() : nonEmpty("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
  const appVersion = nonEmpty("APP_VERSION", process.env.APP_VERSION) ?? "0.1.0";

  return Object.freeze({
    nodeEnv,
    siteUrl,
    databaseUrl,
    directUrl: nonEmpty("DIRECT_URL", process.env.DIRECT_URL),
    appVersion,
    commitSha: nonEmpty("COMMIT_SHA", process.env.COMMIT_SHA) ?? nonEmpty("COMMIT_REF", process.env.COMMIT_REF),
    deployId: nonEmpty("DEPLOY_ID", process.env.DEPLOY_ID),
    deployContext: nonEmpty("CONTEXT", process.env.CONTEXT),
  });
}

export function validateServerEnvironment(): ServerEnvironment {
  const env = readServerEnvironment();

  const providerReference = nonEmpty("FULFILLMENT_PROVIDER_SECRET_REFERENCE", process.env.FULFILLMENT_PROVIDER_SECRET_REFERENCE);
  const fulfillmentEnabled = /^(1|true)$/i.test(process.env.FULFILLMENT_PROVIDER_ENABLED ?? "");
  const fulfillmentMode = process.env.FULFILLMENT_PROVIDER_MODE ?? "test";

  if (providerReference && /^NEXT_PUBLIC_/i.test(providerReference)) {
    throw new Error("FULFILLMENT_PROVIDER_SECRET_REFERENCE cannot reference NEXT_PUBLIC_ configuration.");
  }

  if (fulfillmentEnabled && fulfillmentMode === "live") {
    const secretName = providerReference ?? "QIKINK_CLIENT_SECRET";
    if (!nonEmpty(secretName, process.env[secretName])) {
      throw new Error(`${secretName} is required when live fulfillment is enabled.`);
    }
  }

  const notificationEnabled = /^(1|true)$/i.test(process.env.NOTIFICATION_PROVIDER_ENABLED ?? "");
  if (notificationEnabled && !nonEmpty("NOTIFICATION_PROVIDER_ID", process.env.NOTIFICATION_PROVIDER_ID)) {
    throw new Error("NOTIFICATION_PROVIDER_ID is required when notifications are enabled.");
  }

  return env;
}

export function publicReleaseIdentity(env = readServerEnvironment()) {
  return {
    version: env.appVersion,
    environment: env.nodeEnv,
  };
}
