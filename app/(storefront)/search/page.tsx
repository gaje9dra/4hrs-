import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/storefront/product-grid";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import { searchStorefrontProducts } from "@/lib/storefront/catalog";
import { buildCatalogHref, catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

export const metadata: Metadata = {
  title: "Search | 4HRS",
  description: "Search the public 4HRS catalog.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<StorefrontSearchParams> }) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;

  if (!query?.trim()) {
    return (
      <Container className="py-10 sm:py-14 lg:py-20">
        <header className="max-w-3xl">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Catalog / Search</p>
          <h1 className="mt-3 uppercase">Search</h1>
          <p className="mt-5">Enter a product, category, collection, tag, or variant term. Search remains provider-neutral and uses the canonical public catalog boundary.</p>
        </header>
      </Container>
    );
  }

  const results = await searchStorefrontProducts({ ...catalogQueryFromSearchParams(params), query });

  return (
    <Container className="py-10 sm:py-14 lg:py-20">
      <header className="mb-10">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Catalog / Search</p>
        <h1 className="mt-3 uppercase">Results for “{query}”</h1>
        <p className="mt-4 text-sm">{results.pagination.total} public products matched.</p>
      </header>
      <ProductGrid products={results.items} />
      <CatalogPagination pagination={results.pagination} buildHref={(page) => buildCatalogHref("/search", params, page)} />
    </Container>
  );
}
