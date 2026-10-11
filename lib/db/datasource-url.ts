/**
 * Build the Prisma datasource URL for the serverless runtime.
 *
 * Supabase pooler URLs use PgBouncer compatibility. Use a small but concurrent
 * per-function pool: one connection serializes independent storefront reads and
 * can cause P2024 timeouts when one query is slow. PRISMA_CONNECTION_LIMIT is
 * the explicit runtime control; it intentionally overrides any URL parameter so
 * a stale connection_limit=1 in DATABASE_URL cannot silently disable the fix.
 * Keep the default conservative to limit connection fan-out across serverless
 * instances; the Supabase pooler remains responsible for sharing DB sessions.
 */
export function getRuntimeDatasourceUrl(
  configuredUrl: string | undefined,
  connectionLimitOverride?: string,
): string | undefined {
  if (!configuredUrl) return undefined;

  try {
    const url = new URL(configuredUrl);
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      url.searchParams.set("pgbouncer", "true");

      const requestedLimit = Number(connectionLimitOverride);
      const connectionLimit =
        Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 20
          ? requestedLimit
          : 3;
      url.searchParams.set("connection_limit", String(connectionLimit));
    }
    return url.toString();
  } catch {
    // Leave malformed URLs for Prisma's normal configuration error handling.
    return configuredUrl;
  }
}
