import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/storefront/product-grid";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import { CatalogFilters } from "@/components/storefront/catalog-filters";
import type { StorefrontCategoryOption, StorefrontCollectionOption, StorefrontProductList, StorefrontTag } from "@/lib/storefront/catalog";
import type { StorefrontSearchParams } from "@/lib/storefront/query-params";
import Link from "next/link";
import { buildCatalogHref } from "@/lib/storefront/query-params";
import { SearchInput } from "@/components/storefront/search-input";

export function CatalogListing({
  pathname, title, eyebrow, description, products, params, categories, collections, tags, fixedCategory, fixedCollection, breadcrumbs = [], searchQuery, emptyTitle, emptyDescription, searchRelevance,
}: {
  pathname: string;
  title: string;
  eyebrow: string;
  description?: string | null;
  products: StorefrontProductList;
  params: StorefrontSearchParams;
  categories: StorefrontCategoryOption[];
  collections: StorefrontCollectionOption[];
  tags: StorefrontTag[];
  fixedCategory?: string;
  fixedCollection?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  searchQuery?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  searchRelevance?: boolean;
}) {
  const totalLabel = products.pagination.total === 1 ? "1 PRODUCT" : products.pagination.total + " PRODUCTS";
  const outOfRange = products.pagination.isOutOfRange;
  const empty = products.items.length === 0 && !outOfRange;

  return (
    <Container className="py-10 sm:py-14 lg:py-20">
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb" className="mb-6 text-sm font-700 uppercase">
          {breadcrumbs.map((item, index) => (
            <span key={item.href ?? item.label}>
              {index > 0 ? <span aria-hidden="true"> / </span> : null}
              {item.href ? <Link href={item.href} className="motion-link">{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      {searchQuery !== undefined ? (
        <section aria-labelledby="search-input-title" className="mb-10 border-4 border-border bg-primary-yellow p-5 shadow-hard-md sm:p-7">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Store / Search</p>
          <h2 id="search-input-title" className="mt-2 uppercase">Find what you want</h2>
          <div className="mt-5"><SearchInput defaultValue={searchQuery} preservedParams={params} /></div>
        </section>
      ) : null}

      <header className="mb-8 grid gap-5 lg:grid-cols-[1fr_1.5fr] lg:items-end">
        <div>
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">{eyebrow}</p>
          <h1 className="mt-3 uppercase">{title}</h1>
        </div>
        <div>
          {description ? <p className="max-w-3xl text-base leading-7 lg:text-lg">{description}</p> : null}
          <p className="mt-4 text-sm font-900 uppercase tracking-widest" aria-live="polite">{totalLabel}</p>
        </div>
      </header>

      <div className="mb-8">
        <CatalogFilters pathname={pathname} appliedQuery={products.appliedQuery} categories={categories} collections={collections} tags={tags} fixedCategory={fixedCategory} fixedCollection={fixedCollection} preservedParams={searchQuery !== undefined ? { q: searchQuery } : undefined} searchRelevance={searchRelevance} />
      </div>

      {outOfRange ? (
        <section aria-labelledby="catalog-page-range-title" className="border-4 border-border bg-primary-yellow p-8 shadow-hard-md sm:p-10">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Page Range</p>
          <h2 id="catalog-page-range-title" className="mt-3 uppercase">That page is no longer available</h2>
          <p className="mt-4 max-w-2xl text-base leading-7">The catalog has changed and page {products.pagination.page} is outside the current result range. Return to the last available page without changing your filters or sorting.</p>
          <Link href={buildCatalogHref(pathname, params, products.pagination.totalPages)} className="motion-press mt-7 inline-flex min-h-12 items-center border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
            Go to page {products.pagination.totalPages}
          </Link>
        </section>
      ) : empty ? (
        <section aria-labelledby="catalog-empty-title" className="border-4 border-border bg-primary-yellow p-8 shadow-hard-md sm:p-10">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Empty</p>
          <h2 id="catalog-empty-title" className="mt-3 uppercase">{emptyTitle ?? (searchQuery ? <>No results for “{searchQuery}”</> : "No products found")}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7">{emptyDescription ?? (searchQuery ? "Try another search or explore the full collection." : "Try changing your filters or return to the full shop.")}</p>
          <Link href="/shop" className="motion-press mt-7 inline-flex min-h-12 items-center border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
            Shop all
          </Link>
        </section>
      ) : (
        <ProductGrid products={products.items} />
      )}

      {!empty && !outOfRange ? <CatalogPagination pagination={products.pagination} buildHref={(page) => buildCatalogHref(pathname, params, page)} /> : null}
    </Container>
  );
}
