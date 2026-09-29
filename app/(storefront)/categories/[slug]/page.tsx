import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicCategorySeoMetadata } from "@/lib/catalog/seo";
import { getStorefrontCategory, getStorefrontCategoryProducts } from "@/lib/storefront/catalog";
import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/storefront/product-grid";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import { buildCatalogHref, catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

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
  const category = await loadCategory(slug);
  const paramsObject = await searchParams;
  const products = await getStorefrontCategoryProducts(slug, catalogQueryFromSearchParams(paramsObject));

  return (
    <Container className="py-10 sm:py-14 lg:py-20">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm font-700 uppercase">
        <a href="/shop" className="motion-link">Shop</a>
        {category.breadcrumbs.map((item) => (
          <span key={item.slug}> <span aria-hidden="true">/</span> <span aria-current={item.slug === category.slug ? "page" : undefined}>{item.name}</span></span>
        ))}
      </nav>
      <header className="mb-10">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Category</p>
        <h1 className="mt-3 uppercase">{category.name}</h1>
        {category.description ? <p className="mt-5 max-w-2xl text-lg">{category.description}</p> : null}
      </header>
      <ProductGrid products={products.items} />
      <CatalogPagination pagination={products.pagination} buildHref={(page) => buildCatalogHref("/categories/" + encodeURIComponent(category.slug), paramsObject, page)} />
    </Container>
  );
}
