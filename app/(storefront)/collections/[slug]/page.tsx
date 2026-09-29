import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicCollectionSeoMetadata } from "@/lib/catalog/seo";
import { getStorefrontCollection, getStorefrontCollectionProducts, getStorefrontListingFilters } from "@/lib/storefront/catalog";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

type Params = Promise<{ slug: string }>;

async function loadCollection(slug: string) {
  try { return await getStorefrontCollection(slug); }
  catch (error) {
    if (error instanceof CatalogServiceError && error.code === "COLLECTION_NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const collection = await loadCollection((await params).slug);
    const seo = getPublicCollectionSeoMetadata(collection);
    if (!seo) return { robots: { index: false, follow: true } };
    return { title: seo.title, description: seo.description, alternates: { canonical: seo.canonicalUrl }, robots: seo.robots };
  } catch { return { robots: { index: false, follow: false } }; }
}

export default async function CollectionPage({ params, searchParams }: { params: Params; searchParams: Promise<StorefrontSearchParams> }) {
  const { slug } = await params;
  const paramsObject = await searchParams;
  const collection = await loadCollection(slug);
  const [products, filters] = await Promise.all([
    getStorefrontCollectionProducts(slug, catalogQueryFromSearchParams(paramsObject)),
    getStorefrontListingFilters(),
  ]);

  return (
    <CatalogListing
      pathname={"/collections/" + encodeURIComponent(collection.slug)}
      title={collection.name}
      eyebrow="Catalog / Collection"
      description={collection.description}
      products={products}
      params={paramsObject}
      {...filters}
      fixedCollection={collection.slug}
      breadcrumbs={[{ label: "Shop", href: "/shop" }, { label: collection.name }]}
    />
  );
}
