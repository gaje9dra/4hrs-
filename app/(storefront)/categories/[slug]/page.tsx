import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicCategorySeoMetadata } from "@/lib/catalog/seo";
import { getStorefrontCategory, getStorefrontCategoryProducts, getStorefrontListingFilters } from "@/lib/storefront/catalog";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

type Params = Promise<{ slug: string }>;

async function loadCategory(slug: string) {
  try {
    return await getStorefrontCategory(slug);
  } catch (error) {
    if (error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const category = await loadCategory((await params).slug);
    const seo = getPublicCategorySeoMetadata(category);
    if (!seo) return { robots: { index: false, follow: true } };
    return { title: seo.title, description: seo.description, alternates: { canonical: seo.canonicalUrl }, robots: seo.robots };
  } catch {
    return { robots: { index: false, follow: false } };
  }
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Promise<StorefrontSearchParams> }) {
  const { slug } = await params;
  const paramsObject = await searchParams;
  const category = await loadCategory(slug);
  const [products, filters] = await Promise.all([
    getStorefrontCategoryProducts(slug, catalogQueryFromSearchParams(paramsObject)),
    getStorefrontListingFilters(),
  ]);

  return (
    <CatalogListing
      pathname={"/categories/" + encodeURIComponent(category.slug)}
      title={category.name}
      eyebrow="Catalog / Category"
      description={category.description}
      products={products}
      params={paramsObject}
      {...filters}
      fixedCategory={category.slug}
    />
  );
}
