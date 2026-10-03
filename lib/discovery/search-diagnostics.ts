import { db } from "@/lib/db/client";
import { incrementMetric } from "@/lib/observability/metrics";

export async function getSearchDiagnostics(sinceHours = 24) {
  const hours = Math.max(1, Math.min(168, Math.trunc(sinceHours)));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db.$queryRaw<Array<{ total: bigint; zero: bigint }>>\`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE COALESCE((properties->>'resultCount')::integer, 0) = 0
      )::bigint AS zero
    FROM "AnalyticsEvent"
    WHERE "eventName" = 'SEARCH_PERFORMED'
      AND "occurredAt" >= ${since}
  \`;
  const total = Number(rows[0]?.total ?? 0);
  const zero = Number(rows[0]?.zero ?? 0);
  incrementMetric("search_quality_observations_total", { operation: "diagnostics" });
  return {
    since: since.toISOString(),
    searchVolume: total,
    zeroResultSearches: zero,
    zeroResultRate: total === 0 ? 0 : zero / total,
    availableSignals: ["search volume", "zero-result rate"],
    unavailableSignals: ["raw popular queries", "raw reformulation pairs", "historical latency"],
    privacy: "No raw customer search history is returned by this endpoint.",
  };
}
