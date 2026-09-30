import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicCollectionSeoMetadata } from "@/lib/catalog/seo";
import { collectionPath } from "@/lib/catalog/routes";
import {
  getStorefrontCollection,
  getStorefrontCollectionProducts,
  getStorefrontListingFilters,
} from "@/lib/storefront/catalog";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import {
  catalogQueryFromSearchParams,
  type StorefrontSearchParams,
} from "@/lib/storefront/query-params";

type Params = Promise<{ slug: string }>;

async function loadCollection(slug: string) {
  try {
    return await getStorefrontCollection(slug);
  } catch (error) {
    if (
      error instanceof CatalogServiceError &&
      (error.code === "COLLECTION_NOT_FOUND" || error.code === "INVALID_QUERY")
    ) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const collection = await loadCollection((await params).slug);
  const seo = getPublicCollectionSeoMetadata(collection);

  if (!seo) return { robots: { index: false, follow: false } };

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalUrl },
    robots: seo.robots,
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<StorefrontSearchParams>;
}) {
  const { slug } = await params;
  const paramsObject = await searchParams;
  const collection = await loadCollection(slug);

  const query = catalogQueryFromSearchParams({
    ...paramsObject,
    collection: collection.slug,
  });

  const [products, filters] = await Promise.all([
    getStorefrontCollectionProducts(collection.slug, query),
    getStorefrontListingFilters("collection"),
  ]);

  const collectionParams: StorefrontSearchParams = {
    ...paramsObject,
    collection: collection.slug,
  };

  return (
    <CatalogListing
      pathname={collectionPath(collection)}
      title={collection.name}
      eyebrow="Catalog / Collection"
      description={collection.description}
      products={products}
      params={collectionParams}
      {...filters}
      fixedCollection={collection.slug}
      emptyTitle={collection.hasPublishedProducts ? undefined : "This collection is empty"}
      emptyDescription={
        collection.hasPublishedProducts
          ? undefined
          : "This collection does not currently have any published products."
      }
      breadcrumbs={[
        { label: "Shop", href: "/shop" },
        { label: collection.name },
      ]}
    />
  );
}
