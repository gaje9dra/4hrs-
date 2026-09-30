import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicCategorySeoMetadata } from "@/lib/catalog/seo";
import { categoryPath } from "@/lib/catalog/routes";
import { getStorefrontCategory, getStorefrontCategoryProducts, getStorefrontListingFilters } from "@/lib/storefront/catalog";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

type Params = Promise<{ slug: string }>;

async function loadCategory(slug: string) {
  try {
    return await getStorefrontCategory(slug);
  } catch (error) {
    if (
      error instanceof CatalogServiceError &&
      (error.code === "CATEGORY_NOT_FOUND" || error.code === "INVALID_QUERY")
    ) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = await loadCategory((await params).slug);
  const seo = getPublicCategorySeoMetadata(category);

  if (!seo) {
    return { robots: { index: false, follow: false } };
  }

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalUrl },
    robots: seo.robots,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<StorefrontSearchParams>;
}) {
  const { slug } = await params;
  const paramsObject = await searchParams;
  const category = await loadCategory(slug);
  const query = catalogQueryFromSearchParams({ ...paramsObject, category: category.slug });

  const [products, filters] = await Promise.all([
    getStorefrontCategoryProducts(category.slug, query),
    getStorefrontListingFilters("category"),
  ]);

  const categoryParams: StorefrontSearchParams = {
    ...paramsObject,
    category: category.slug,
  };

  return (
    <CatalogListing
      pathname={categoryPath(category)}
      title={category.name}
      eyebrow="Catalog / Category"
      description={category.description}
      products={products}
      params={categoryParams}
      {...filters}
      fixedCategory={category.slug}
      emptyTitle={
        category.hasPublishedProducts
          ? undefined
          : "This category is empty"
      }
      emptyDescription={
        category.hasPublishedProducts
          ? undefined
          : "This category does not currently have any published products."
      }
      breadcrumbs={[
        { label: "Shop", href: "/shop" },
        ...category.breadcrumbs.map((item, index) => ({
          label: item.name,
          href: index === category.breadcrumbs.length - 1 ? undefined : categoryPath(item),
        })),
      ]}
    />
  );
}
