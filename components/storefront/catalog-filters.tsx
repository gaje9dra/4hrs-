import Link from "next/link";
import type { CatalogAppliedQuery, CatalogSort } from "@/lib/catalog/query";
import type { StorefrontCategoryOption, StorefrontCollectionOption, StorefrontTag } from "@/lib/storefront/catalog";
import { buildCatalogFilterHref } from "@/lib/storefront/query-params";

const sortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "title_asc", label: "Name: A–Z" },
  { value: "title_desc", label: "Name: Z–A" },
  { value: "updated", label: "Recently updated" },
];

const contextualSort = [...sortOptions, { value: "merchandising" as const, label: "Recommended" }];

export function CatalogFilters({
  pathname,
  appliedQuery,
  categories,
  collections,
  tags,
  fixedCategory,
  fixedCollection,
  preservedParams = {},
  searchRelevance = false,
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
  const preservedQuery = preservedParams.q
    ? Array.isArray(preservedParams.q)
      ? preservedParams.q[0]
      : preservedParams.q
    : undefined;

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
      label: "From ₹" + appliedQuery.minPrice,
      href: buildCatalogFilterHref(pathname, { ...baseValues, minPrice: undefined }),
    });
  }

  if (appliedQuery.maxPrice) {
    activeFilters.push({
      label: "Up to ₹" + appliedQuery.maxPrice,
      href: buildCatalogFilterHref(pathname, { ...baseValues, maxPrice: undefined }),
    });
  }

  if (appliedQuery.inStock) {
    activeFilters.push({
      label: "In stock",
      href: buildCatalogFilterHref(pathname, { ...baseValues, inStock: undefined }),
    });
  }

  const controlClass =
    "min-h-12 w-full border-2 border-border bg-white px-3 py-2.5 text-sm font-700 transition-[border-color,box-shadow] duration-(--motion-fast) hover:border-primary-blue focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue";

  return (
    <section
      aria-label="Filter and sort products"
      className="border-2 border-border bg-white shadow-hard-sm sm:border-4 sm:shadow-hard-md"
    >
      <div className="flex flex-col gap-2 border-b-2 border-border bg-foreground px-4 py-4 text-white sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="text-[0.68rem] font-900 uppercase tracking-[0.2em] text-primary-yellow">Product discovery</p>
          <h2 className="mt-1 text-xl font-900 uppercase tracking-tight text-white">Filter &amp; sort</h2>
        </div>
        {activeFilters.length ? (
          <p className="text-xs font-700 uppercase tracking-wider text-white/70">
            {activeFilters.length} {activeFilters.length === 1 ? "filter" : "filters"} applied
          </p>
        ) : (
          <p className="text-xs font-700 uppercase tracking-wider text-white/70">Refine the catalog</p>
        )}
      </div>

      <form method="get" action={pathname} className="p-4 sm:p-5 lg:p-6">
        {preservedQuery ? <input type="hidden" name="q" value={preservedQuery} /> : null}

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {!fixedCategory ? (
              <label className="grid min-w-0 gap-2">
                <span className="text-[0.68rem] font-900 uppercase tracking-[0.16em]">Category</span>
                <select name="category" defaultValue={appliedQuery.category ?? ""} className={controlClass}>
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {!fixedCollection ? (
              <label className="grid min-w-0 gap-2">
                <span className="text-[0.68rem] font-900 uppercase tracking-[0.16em]">Collection</span>
                <select name="collection" defaultValue={appliedQuery.collection ?? ""} className={controlClass}>
                  <option value="">All collections</option>
                  {collections.map((collection) => (
                    <option key={collection.slug} value={collection.slug}>{collection.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="grid min-w-0 gap-2">
              <span className="text-[0.68rem] font-900 uppercase tracking-[0.16em]">Sort by</span>
              <select name="sort" defaultValue={searchRelevance ? "" : appliedQuery.sort} className={controlClass}>
                {searchRelevance ? <option value="">Relevance</option> : null}
                {options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-2">
              <span className="text-[0.68rem] font-900 uppercase tracking-[0.16em]">Tag matching</span>
              <select name="tagMode" defaultValue={appliedQuery.tagMode} className={controlClass}>
                <option value="AND">Match all selected</option>
                <option value="OR">Match any selected</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-3 border-2 border-border bg-primary-yellow px-4 py-2.5 text-xs font-900 uppercase tracking-[0.12em]">
              <input type="checkbox" name="inStock" value="true" defaultChecked={appliedQuery.inStock} className="h-4 w-4 accent-black" />
              In stock only
            </label>
            <button
              type="submit"
              className="min-h-12 border-2 border-border bg-primary-blue px-5 py-2.5 text-sm font-900 uppercase text-white shadow-hard-sm transition-transform duration-(--motion-fast) hover:-translate-y-px hover:bg-primary-red focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
            >
              Apply filters
            </button>
            <Link
              href={clearHref}
              className="inline-flex min-h-12 items-center justify-center border-2 border-transparent px-2 py-2.5 text-sm font-900 uppercase no-underline underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
            >
              Clear all
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t-2 border-border pt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)]">
          <fieldset className="min-w-0">
            <legend className="text-[0.68rem] font-900 uppercase tracking-[0.16em]">Tags</legend>
            {tags.length ? (
              <div className="mt-3 grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
                {tags.map((tag) => {
                  const selected = appliedQuery.tags.includes(tag.slug);
                  return (
                    <label
                      key={tag.slug}
                      className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-border bg-white px-3 py-2 text-xs font-700 uppercase leading-tight transition-colors hover:border-primary-blue hover:bg-primary-yellow"
                    >
                      <input
                        type="checkbox"
                        name="tags"
                        value={tag.slug}
                        defaultChecked={selected}
                        className="h-4 w-4 shrink-0 accent-black"
                      />
                      <span className="min-w-0 break-words">{tag.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No tags are available for this catalog yet.</p>
            )}
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="text-[0.68rem] font-900 uppercase tracking-[0.16em]">Price range</legend>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-700 text-muted-foreground">Minimum</span>
                <input
                  name="minPrice"
                  inputMode="decimal"
                  defaultValue={appliedQuery.minPrice ?? ""}
                  placeholder="₹500"
                  className={controlClass}
                  aria-label="Minimum price"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-700 text-muted-foreground">Maximum</span>
                <input
                  name="maxPrice"
                  inputMode="decimal"
                  defaultValue={appliedQuery.maxPrice ?? ""}
                  placeholder="₹1,500"
                  className={controlClass}
                  aria-label="Maximum price"
                />
              </label>
            </div>
          </fieldset>
        </div>
      </form>

      {activeFilters.length ? (
        <div className="border-t-2 border-border bg-muted/40 px-4 py-4 sm:px-5" aria-label="Applied filters">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[0.68rem] font-900 uppercase tracking-[0.16em]">Applied</span>
            {activeFilters.map((filter) => (
              <Link
                key={filter.label}
                href={filter.href}
                className="inline-flex min-h-9 items-center gap-2 border-2 border-border bg-primary-yellow px-3 py-1.5 text-xs font-900 uppercase no-underline shadow-hard-sm transition-transform duration-(--motion-fast) hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
                aria-label={"Remove " + filter.label}
              >
                <span className="break-words">{filter.label}</span>
                <span aria-hidden="true">×</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
