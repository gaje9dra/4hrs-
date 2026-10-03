import type { Metadata } from "next";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getStorefrontHomeCatalogData } from "@/lib/storefront/catalog";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { listPublishedContentByType, resolvePublishedContentPresentation } from "@/lib/content/service";
import { Homepage } from "@/components/storefront/homepage";

export const metadata: Metadata = { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog through a bold Bauhaus-inspired storefront.", alternates: { canonical: "/" }, robots: { index: true, follow: true }, openGraph: { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog.", url: "/", type: "website" } };

export default async function HomePage() {
  const locale = await resolveRequestLocale();
  let data; try { data = await getStorefrontHomeCatalogData(); } catch (error) { if (error instanceof CatalogServiceError) throw error; throw new Error("Homepage catalog data could not be loaded.", { cause: error }); }
  const editorial = await listPublishedContentByType("HOMEPAGE_SECTION", locale);
  const banners = await listPublishedContentByType("PROMOTIONAL_BANNER", locale);
  const editorialSections = await resolvePublishedContentPresentation([...editorial, ...banners]);
  return <Homepage data={data} editorialSections={editorialSections} />;
}
