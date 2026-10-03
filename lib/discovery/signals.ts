import { db } from "@/lib/db/client";
import { incrementMetric, observeMetric } from "@/lib/observability/metrics";

export const DISCOVERY_WINDOWS = { RECENT_HOURS: 24, TRENDING_DAYS: 7, POPULARITY_DAYS: 30 } as const;

export type DiscoverySignal = {
  productId: string;
  views: number;
  addToCarts: number;
  popularityScore: number;
  trendingScore: number;
  freshnessScore: number;
  sampleWindowDays: number;
};

type SignalEventRow = {
  productId: string;
  views: bigint;
  addToCarts: bigint;
  recentViews: bigint;
  recentAddToCarts: bigint;
  distinctSubjects: bigint;
};

function boundedLog(value: number): number {
  return Math.log1p(Math.max(0, Math.min(value, 100000)));
}

function scoreRow(row: SignalEventRow): DiscoverySignal {
  const views = Number(row.views);
  const addToCarts = Number(row.addToCarts);
  const recentViews = Number(row.recentViews);
  const recentAddToCarts = Number(row.recentAddToCarts);
  const subjects = Math.max(1, Number(row.distinctSubjects));
  const engagement = boundedLog(views) * 0.4 + boundedLog(addToCarts) * 0.6;
  const exposureAdjusted = engagement / Math.sqrt(subjects);
  const recent = boundedLog(recentViews) * 0.35 + boundedLog(recentAddToCarts) * 0.65;
  const baseline = Math.max(0.1, boundedLog(views) * 0.35 + boundedLog(addToCarts) * 0.65);
  return {
    productId: row.productId,
    views,
    addToCarts,
    popularityScore: Math.min(100, exposureAdjusted * 10),
    trendingScore: Math.min(100, (recent / baseline) * 50),
    freshnessScore: recent > 0 ? 100 : 0,
    sampleWindowDays: DISCOVERY_WINDOWS.POPULARITY_DAYS,
  };
}

export async function getDiscoverySignals(input: {
  environment?: "DEVELOPMENT" | "TEST" | "STAGING" | "PRODUCTION";
  productIds?: string[];
  now?: Date;
} = {}): Promise<DiscoverySignal[]> {
  const now = input.now ?? new Date();
  const popularitySince = new Date(now.getTime() - DISCOVERY_WINDOWS.POPULARITY_DAYS * 24 * 60 * 60 * 1000);
  const recentSince = new Date(now.getTime() - DISCOVERY_WINDOWS.RECENT_HOURS * 60 * 60 * 1000);
  const started = performance.now();

  try {
    const rows = await db.$queryRaw<SignalEventRow[]>\`
      SELECT
        COALESCE(properties->>'productId','') AS "productId",
        COUNT(*) FILTER (WHERE "eventName" = 'PRODUCT_VIEWED')::bigint AS views,
        COUNT(*) FILTER (WHERE "eventName" = 'ADD_TO_CART')::bigint AS "addToCarts",
        COUNT(*) FILTER (WHERE "eventName" = 'PRODUCT_VIEWED' AND "occurredAt" >= ${recentSince})::bigint AS "recentViews",
        COUNT(*) FILTER (WHERE "eventName" = 'ADD_TO_CART' AND "occurredAt" >= ${recentSince})::bigint AS "recentAddToCarts",
        COUNT(DISTINCT COALESCE("customerId"::text, "anonymousId", "eventId"))::bigint AS "distinctSubjects"
      FROM "AnalyticsEvent"
      WHERE "occurredAt" >= ${popularitySince}
        AND "eventName" IN ('PRODUCT_VIEWED','ADD_TO_CART')
        AND COALESCE(properties->>'productId','') <> ''
      GROUP BY properties->>'productId'
      ORDER BY "addToCarts" DESC, views DESC, "productId" ASC
      LIMIT 200
    \`;
    const allowed = input.productIds ? new Set(input.productIds.slice(0, 200)) : null;
    const signals = rows.filter((row) => /^[0-9a-fA-F-]{36}$/.test(row.productId) && (!allowed || allowed.has(row.productId))).map(scoreRow);
    incrementMetric("discovery_signal_calculations_total", { operation: "signals", environment: input.environment ?? "unknown" });
    observeMetric("discovery_signal_calculation_latency_ms", performance.now() - started, { environment: input.environment ?? "unknown" });
    return signals;
  } catch (error) {
    incrementMetric("discovery_signal_calculations_total", { operation: "error", environment: input.environment ?? "unknown" });
    observeMetric("discovery_signal_calculation_latency_ms", performance.now() - started, { environment: input.environment ?? "unknown" });
    throw error;
  }
}

export function explainDiscoverySignal(signal: DiscoverySignal) {
  return {
    sourceEvents: ["PRODUCT_VIEWED", "ADD_TO_CART"],
    formula: "bounded log exposure/intent with subject-count normalization; recent-window ratio for trending; deterministic product-id tie-breaking",
    privacy: "Aggregated only; no raw query history or sensitive attributes.",
    failureBehavior: "Analytics failure falls back to canonical catalog relevance and explicit merchandising.",
    signal,
  };
}
