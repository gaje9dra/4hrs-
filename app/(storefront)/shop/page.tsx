import type { Metadata } from "next";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { getStorefrontListingFilters, getStorefrontProducts } from "@/lib/storefront/catalog";
import { catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

export async function generateMetadata({ searchParams }: { searchParams: Promise<StorefrontSearchParams> }): Promise<Metadata> {
  const params = await searchParams; const keys = Object.keys(params); const hasQuery = keys.some((key) => key !== "page");
  const page = typeof params.page === "string" ? Number(params.page) : undefined;
  const canonical = page && page > 1 && !hasQuery ? "/shop?page=" + encodeURIComponent(String(page)) : "/shop";
  return { title: "Shop | 4HRS", description: "Browse the public 4HRS fashion catalog.", alternates: { canonical }, robots: { index: !hasQuery, follow: true }, openGraph: { title: "Shop | 4HRS", description: "Browse the public 4HRS fashion catalog.", url: canonical, type: "website" } };
}
export default async function ShopPage({ searchParams }: { searchParams: Promise<StorefrontSearchParams> }) {
  const params = await searchParams; const query = catalogQueryFromSearchParams(params);
  const [products, filters] = await Promise.all([getStorefrontProducts(query), getStorefrontListingFilters("shop")]);
  return <CatalogListing pathname="/shop" title="Shop" eyebrow="Catalog / Shop" description="Explore the published 4HRS catalog. Sort and filter through the canonical catalog discovery system." products={products} params={params} {...filters} />;
}
