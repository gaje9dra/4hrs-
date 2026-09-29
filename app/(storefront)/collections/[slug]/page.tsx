import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicCollectionSeoMetadata } from "@/lib/catalog/seo";
import { getStorefrontCollection, getStorefrontCollectionProducts } from "@/lib/storefront/catalog";
import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/storefront/product-grid";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import { buildCatalogHref, catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

type Params = Promise<{ slug: string }>;

async function loadCollection(slug: string) {
  try {
    return await getStorefrontCollection(slug);
  } catch (error) {
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
  } catch {
    return { robots: { index: false, follow: false } };
  }
}

export default async function CollectionPage({ params, searchParams }: { params: Params; searchParams: Promise<StorefrontSearchParams> }) {
  const { slug } = await params;
  const collection = await loadCollection(slug);
  const paramsObject = await searchParams;
  const products = await getStorefrontCollectionProducts(slug, catalogQueryFromSearchParams(paramsObject));

  return (
    <Container className="py-10 sm:py-14 lg:py-20">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm font-700 uppercase">
        <a href="/shop" className="motion-link">Shop</a>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{collection.name}</span>
      </nav>
      <header className="mb-10">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Collection</p>
        <h1 className="mt-3 uppercase">{collection.name}</h1>
        {collection.description ? <p className="mt-5 max-w-2xl text-lg">{collection.description}</p> : null}
      </header>
      <ProductGrid products={products.items} />
      <CatalogPagination pagination={products.pagination} buildHref={(page) => buildCatalogHref("/collections/" + encodeURIComponent(collection.slug), paramsObject, page)} />
    </Container>
  );
}
