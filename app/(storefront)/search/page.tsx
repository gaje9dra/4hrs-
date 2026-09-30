import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { CatalogListing } from "@/components/storefront/catalog-listing";
import { CatalogErrorState } from "@/components/storefront/catalog-error";
import { SearchInput } from "@/components/storefront/search-input";
import { getStorefrontListingFilters, searchStorefrontProducts } from "@/lib/storefront/catalog";
import { catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

export const metadata: Metadata = {
  title: "Search | 4HRS",
  description: "Search the public 4HRS catalog.",
  alternates: { canonical: "/search" },
  robots: "noindex,follow",
};

function normalizeDisplayQuery(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ");
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<StorefrontSearchParams> }) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery === undefined ? "" : normalizeDisplayQuery(rawQuery);

  if (!query) {
    return (
      <Container className="py-10 sm:py-14 lg:py-20">
        <header className="max-w-3xl">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Store / Search</p>
          <h1 className="mt-3 uppercase">Search the store</h1>
          <p className="mt-5 text-base leading-7">Find products by name, category, collection, tag, or variant term.</p>
        </header>
        <section aria-labelledby="search-landing-title" className="mt-8 border-4 border-border bg-primary-yellow p-5 shadow-hard-md sm:p-8">
          <h2 id="search-landing-title" className="sr-only">Search input</h2>
          <SearchInput />
        </section>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <p className="text-sm font-900 uppercase tracking-widest">Ready to browse?</p>
          <Link href="/shop" className="motion-press inline-flex min-h-12 items-center border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">Shop all</Link>
        </div>
      </Container>
    );
  }

  try {
    const [products, filters] = await Promise.all([
      searchStorefrontProducts({ ...catalogQueryFromSearchParams(params), query }),
      getStorefrontListingFilters("search"),
    ]);

    return (
      <CatalogListing
        pathname="/search"
        title={`Search results for “${query}”`}
        eyebrow="Store / Search"
        description="Deterministic public catalog search with the same canonical filters and pagination used across the storefront."
        products={products}
        params={params}
        {...filters}
        searchQuery={query}
        searchRelevance
      />
    );
  } catch (error) {
    if (
      error instanceof CatalogServiceError &&
      ["INVALID_QUERY", "INVALID_PAGE", "INVALID_SORT", "INVALID_PRICE_RANGE"].includes(error.code)
    ) {
      return (
        <Container className="py-10 sm:py-14 lg:py-20">
          <header className="max-w-3xl">
            <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Store / Search</p>
            <h1 className="mt-3 uppercase">Search query needs attention</h1>
            <p className="mt-5 text-base leading-7">Enter a valid product search and try again.</p>
          </header>
          <section aria-labelledby="search-invalid-title" className="mt-8 border-4 border-border bg-primary-yellow p-5 shadow-hard-md sm:p-8">
            <h2 id="search-invalid-title" className="sr-only">Correct the search query</h2>
            <SearchInput defaultValue={query} preservedParams={params} />
          </section>
        </Container>
      );
    }
    return <CatalogErrorState />;
  }
}
