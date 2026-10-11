/**
 * Build the Prisma datasource URL for the serverless runtime.
 *
 * Supabase pooler URLs need pgbouncer compatibility enabled. Limit each
 * serverless runtime's local Prisma pool to one connection by default so a
 * burst of warm/cold function instances does not multiply the database
 * connection count without bound. Existing URL settings take precedence;
 * PRISMA_CONNECTION_LIMIT can override the default with a positive integer.
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

      if (!url.searchParams.has("connection_limit")) {
        const requestedLimit = Number(connectionLimitOverride);
        const connectionLimit =
          Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 100
            ? requestedLimit
            : 1;
        url.searchParams.set("connection_limit", String(connectionLimit));
      }
    }
    return url.toString();
  } catch {
    // Leave malformed URLs for Prisma's normal configuration error handling.
    return configuredUrl;
  }
}
