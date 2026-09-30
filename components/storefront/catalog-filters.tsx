import Link from "next/link";
import type { CatalogAppliedQuery, CatalogSort } from "@/lib/catalog/query";
import type { StorefrontCategoryOption, StorefrontCollectionOption, StorefrontTag } from "@/lib/storefront/catalog";
import { buildCatalogFilterHref } from "@/lib/storefront/query-params";

const sortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "title_asc", label: "Title: A–Z" },
  { value: "title_desc", label: "Title: Z–A" },
  { value: "updated", label: "Recently updated" },
];

const contextualSort = [...sortOptions, { value: "merchandising" as const, label: "Curated order" }];

export function CatalogFilters({
  pathname, appliedQuery, categories, collections, tags, fixedCategory, fixedCollection, preservedParams = {}, searchRelevance = false,
}: {
  pathname: string;
  appliedQuery: CatalogAppliedQuery;
  categories: StorefrontCategoryOption[];
  collections: StorefrontCollectionOption[];
  tags: StorefrontTag[];
  fixedCategory?: string;
  fixedCollection?: string;
  preservedParams?: { q?: string | string[] };
  searchRelevance?: boolean;
}) {
  const options = fixedCategory || fixedCollection ? contextualSort : sortOptions;
  const preservedQuery = preservedParams.q ? (Array.isArray(preservedParams.q) ? preservedParams.q[0] : preservedParams.q) : undefined;
  const baseValues: Record<string, string | string[] | undefined> = {
    q: preservedQuery,
    category: appliedQuery.category,
    collection: appliedQuery.collection,
    tags: appliedQuery.tags,
    tagMode: appliedQuery.tags.length ? appliedQuery.tagMode : undefined,
    minPrice: appliedQuery.minPrice,
    maxPrice: appliedQuery.maxPrice,
    inStock: appliedQuery.inStock ? "true" : undefined,
    sort: appliedQuery.sort,
  };
  const clearHref = buildCatalogFilterHref(pathname, { q: preservedQuery });

  const activeFilters: Array<{ label: string; href: string }> = [];

  if (appliedQuery.category && !fixedCategory) {
    activeFilters.push({
      label: "Category: " + (categories.find((item) => item.slug === appliedQuery.category)?.name ?? appliedQuery.category),
      href: buildCatalogFilterHref(pathname, { ...baseValues, category: undefined }),
    });
  }
  if (appliedQuery.collection && !fixedCollection) {
    activeFilters.push({
      label: "Collection: " + (collections.find((item) => item.slug === appliedQuery.collection)?.name ?? appliedQuery.collection),
      href: buildCatalogFilterHref(pathname, { ...baseValues, collection: undefined }),
    });
  }
  for (const tag of appliedQuery.tags) {
    activeFilters.push({
      label: "Tag: " + (tags.find((item) => item.slug === tag)?.name ?? tag),
      href: buildCatalogFilterHref(pathname, {
        ...baseValues,
        tags: appliedQuery.tags.filter((value) => value !== tag),
      }),
    });
  }
  if (appliedQuery.minPrice) {
    activeFilters.push({
      label: "Min: ₹" + appliedQuery.minPrice,
      href: buildCatalogFilterHref(pathname, { ...baseValues, minPrice: undefined }),
    });
  }
  if (appliedQuery.maxPrice) {
    activeFilters.push({
      label: "Max: ₹" + appliedQuery.maxPrice,
      href: buildCatalogFilterHref(pathname, { ...baseValues, maxPrice: undefined }),
    });
  }
  if (appliedQuery.inStock) {
    activeFilters.push({
      label: "In stock",
      href: buildCatalogFilterHref(pathname, { ...baseValues, inStock: undefined }),
    });
  }

  return (
    <section aria-label="Catalog filters" className="border-4 border-border bg-white p-5 shadow-hard-md lg:p-6">
      <form method="get" action={pathname}>
        {preservedQuery ? <input type="hidden" name="q" value={preservedQuery} /> : null}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {!fixedCategory ? (
              <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
                Category
                <select name="category" defaultValue={appliedQuery.category ?? ""} className="min-h-12 border-2 border-border bg-white px-3 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue">
                  <option value="">All categories</option>
                  {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
                </select>
              </label>
            ) : null}

            {!fixedCollection ? (
              <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
                Collection
                <select name="collection" defaultValue={appliedQuery.collection ?? ""} className="min-h-12 border-2 border-border bg-white px-3 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue">
                  <option value="">All collections</option>
                  {collections.map((collection) => <option key={collection.slug} value={collection.slug}>{collection.name}</option>)}
                </select>
              </label>
            ) : null}

            <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
              Sort
              <select name="sort" defaultValue={searchRelevance ? "" : appliedQuery.sort} className="min-h-12 border-2 border-border bg-white px-3 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue">
                {searchRelevance ? <option value="">Relevance</option> : null}
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
              Tags
              <select name="tags" multiple defaultValue={appliedQuery.tags} aria-describedby="catalog-tags-help" className="min-h-12 border-2 border-border bg-white px-3 py-2 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue">
                {tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name}</option>)}
              </select>
              <span id="catalog-tags-help" className="font-500 normal-case tracking-normal">Use Ctrl/Cmd to select multiple tags.</span>
            </label>

            <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
              Tag match
              <select name="tagMode" defaultValue={appliedQuery.tagMode} className="min-h-12 border-2 border-border bg-white px-3 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue">
                <option value="AND">Match all</option>
                <option value="OR">Match any</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
                Min price
                <input name="minPrice" inputMode="decimal" defaultValue={appliedQuery.minPrice ?? ""} placeholder="₹500" className="min-h-12 border-2 border-border bg-white px-3 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue" />
              </label>
              <label className="grid gap-2 text-xs font-900 uppercase tracking-widest">
                Max price
                <input name="maxPrice" inputMode="decimal" defaultValue={appliedQuery.maxPrice ?? ""} placeholder="₹1500" className="min-h-12 border-2 border-border bg-white px-3 text-sm font-700 focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue" />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:min-w-52 lg:justify-end">
            <label className="inline-flex min-h-12 items-center gap-3 border-2 border-border bg-primary-yellow px-4 text-xs font-900 uppercase tracking-widest">
              <input type="checkbox" name="inStock" value="true" defaultChecked={appliedQuery.inStock} className="h-4 w-4 accent-black" />
              In stock
            </label>
            <button type="submit" className="min-h-12 border-2 border-border bg-primary-blue px-5 py-3 text-sm font-900 uppercase text-white shadow-hard-sm hover:bg-primary-red focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
              Apply
            </button>
            <Link href={clearHref} className="motion-link min-h-12 px-2 py-3 text-sm font-900 uppercase no-underline focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2">
              Clear all
            </Link>
          </div>
        </div>
      </form>

      {activeFilters.length ? (
        <div className="mt-5 border-t-2 border-border pt-4" aria-label="Active filters">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-900 uppercase tracking-widest">Active</span>
            {activeFilters.map((filter) => (
              <Link
                key={filter.label}
                href={filter.href}
                className="inline-flex min-h-10 items-center border-2 border-border bg-primary-yellow px-3 py-2 text-xs font-900 uppercase no-underline shadow-hard-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
                aria-label={"Remove " + filter.label}
              >
                {filter.label} <span className="ml-2" aria-hidden="true">×</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
