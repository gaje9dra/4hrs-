import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getStorefrontHomeCatalogData } from "@/lib/storefront/catalog";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { listPublishedContentByType, resolvePublishedContentPresentation } from "@/lib/content/service";
import { Homepage } from "@/components/storefront/homepage";
import { logger } from "@/lib/observability/logger";
import { logPrismaPoolMetrics } from "@/lib/db/client";

export const metadata: Metadata = { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog through a bold Bauhaus-inspired storefront.", alternates: { canonical: "/" }, robots: { index: true, follow: true }, openGraph: { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog.", url: "/", type: "website" } };

const getCachedHomepageData = unstable_cache(
  async (locale: Awaited<ReturnType<typeof resolveRequestLocale>>) => {
    // This callback runs when the shared homepage cache is populated or refreshed,
    // so these timings describe cache-fill work, not cache-hit request latency.
    const fillStartedAt = Date.now();
    const measureFillOperation = async <T>(
      operation: "catalog" | "editorial_content" | "promotional_banners",
      run: () => Promise<T>,
    ): Promise<T> => {
      const startedAt = Date.now();
      try {
        const result = await run();
        const durationMs = Date.now() - startedAt;
        if (durationMs >= 250) {
          logger.warn("storefront.homepage.cache_fill.operation.slow", {
            resourceType: "database",
            outcome: "success",
            durationMs,
          }, { operation, thresholdMs: 250 });
        }
        return result;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        logger.error("storefront.homepage.cache_fill.operation.failed", {
          resourceType: "database",
          outcome: "failure",
          durationMs,
          errorCode: error instanceof Error && /\\bP2024\\b/.test(error.message)
            ? "P2024"
            : "HOMEPAGE_DATA_LOAD_FAILED",
        }, { operation });
        throw error;
      }
    };

    const [data, editorial, banners] = await Promise.all([
      measureFillOperation("catalog", () =>
        getStorefrontHomeCatalogData().catch((error: unknown) => {
          if (error instanceof CatalogServiceError) throw error;
          throw new Error("Homepage catalog data could not be loaded.", { cause: error });
        })),
      measureFillOperation("editorial_content", () =>
        listPublishedContentByType("HOMEPAGE_SECTION", locale)),
      measureFillOperation("promotional_banners", () =>
        listPublishedContentByType("PROMOTIONAL_BANNER", locale)),
    ]);

    const presentationStartedAt = Date.now();
    const editorialSections = await resolvePublishedContentPresentation([...editorial, ...banners]);
    const presentationDurationMs = Date.now() - presentationStartedAt;
    const durationMs = Date.now() - fillStartedAt;
    if (durationMs >= 1000) void logPrismaPoolMetrics("homepage-cache-fill");
    if (durationMs >= 250) {
      logger.warn("storefront.homepage.cache_fill.slow", {
        resourceType: "database",
        outcome: "success",
        durationMs,
      }, {
        presentationDurationMs,
        editorialCount: editorial.length,
        bannerCount: banners.length,
        thresholdMs: 250,
      });
    }
    return { data, editorialSections };
  },
  ["storefront-homepage-data-v1"],
  { revalidate: 30, tags: ["storefront-homepage"] },
);

export default async function HomePage() {
  const locale = await resolveRequestLocale();
  const { data, editorialSections } = await getCachedHomepageData(locale);
  return <Homepage data={data} editorialSections={editorialSections} />;
}
