import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { logger } from "@/lib/observability/logger";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getStorefrontHomeCatalogData } from "@/lib/storefront/catalog";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { listPublishedContentByType, resolvePublishedContentPresentation } from "@/lib/content/service";
import { Homepage } from "@/components/storefront/homepage";

export const metadata: Metadata = { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog through a bold Bauhaus-inspired storefront.", alternates: { canonical: "/" }, robots: { index: true, follow: true }, openGraph: { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog.", url: "/", type: "website" } };

const getCachedHomepageData = unstable_cache(
  async (locale: Awaited<ReturnType<typeof resolveRequestLocale>>) => {
    const [data, editorial, banners] = await Promise.all([
      getStorefrontHomeCatalogData().catch((error: unknown) => {
        if (error instanceof CatalogServiceError) throw error;
        throw new Error("Homepage catalog data could not be loaded.", { cause: error });
      }),
      listPublishedContentByType("HOMEPAGE_SECTION", locale),
      listPublishedContentByType("PROMOTIONAL_BANNER", locale),
    ]);
    const editorialSections = await resolvePublishedContentPresentation([...editorial, ...banners]);
    return { data, editorialSections };
  },
  ["storefront-homepage-data-v1"],
  { revalidate: 30, tags: ["storefront-homepage"] },
);

export default async function HomePage() {
  const requestStartedAt = Date.now();
  const localeStartedAt = Date.now();
  const locale = await resolveRequestLocale();
  const localeDurationMs = Date.now() - localeStartedAt;

  const dataStartedAt = Date.now();
  const { data, editorialSections } = await getCachedHomepageData(locale);
  const dataDurationMs = Date.now() - dataStartedAt;

  logger.info("storefront.homepage.render.prepare", {
    resourceType: "http_request",
    outcome: "success",
    durationMs: Date.now() - requestStartedAt,
  }, {
    route: "/",
    locale,
    localeResolutionMs: localeDurationMs,
    cachedHomepageDataMs: dataDurationMs,
    productCount: data.heroProducts.length + data.featuredProducts.length + data.newArrivals.length,
    editorialSectionCount: editorialSections.length,
  });

  return <Homepage data={data} editorialSections={editorialSections} />;
}
