import type { Metadata } from "next";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { getStorefrontListingFilters, getStorefrontProducts } from "@/lib/storefront/catalog";
import { catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

export const metadata: Metadata = {
  title: "Shop | 4HRS",
  description: "Browse the public 4HRS fashion catalog.",
  alternates: { canonical: "/shop" },
  robots: "index,follow",
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<StorefrontSearchParams> }) {
  const params = await searchParams;
  const query = catalogQueryFromSearchParams(params);
  const [products, filters] = await Promise.all([
    getStorefrontProducts(query),
    getStorefrontListingFilters("shop"),
  ]);

  return (
    <CatalogListing
      pathname="/shop"
      title="Shop"
      eyebrow="Catalog / Shop"
      description="Explore the published 4HRS catalog. Sort and filter through the canonical catalog discovery system."
      products={products}
      params={params}
      {...filters}
    />
  );
}
