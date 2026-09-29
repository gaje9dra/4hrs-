import type { CatalogQuery, CatalogSort } from "@/lib/catalog/query";

export type StorefrontSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function money(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  return normalized;
}

const sorts = new Set<CatalogSort>([
  "newest", "oldest", "price_asc", "price_desc", "title_asc", "title_desc", "updated", "merchandising",
]);

const slugs = (value: string | undefined): string | undefined => {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : undefined;
};

export function catalogQueryFromSearchParams(params: StorefrontSearchParams): CatalogQuery {
  const sortValue = first(params.sort);
  const sort = sortValue && sorts.has(sortValue as CatalogSort) ? sortValue as CatalogSort : undefined;
  const tags = all(params.tags)
    .flatMap((value) => value.split(","))
    .map((tag) => slugs(tag))
    .filter((tag): tag is string => Boolean(tag));
  const inStockValue = first(params.inStock);

  return {
    category: slugs(first(params.category)),
    collection: slugs(first(params.collection)),
    tags: tags.length ? [...new Set(tags)] : undefined,
    tagMode: first(params.tagMode) === "OR" ? "OR" : undefined,
    minPrice: money(first(params.minPrice)),
    maxPrice: money(first(params.maxPrice)),
    inStock: inStockValue === "true" ? true : undefined,
    sort,
    page: positiveInteger(first(params.page)),
    pageSize: positiveInteger(first(params.pageSize)),
  };
}

export function buildCatalogHref(pathname: string, params: StorefrontSearchParams, page: number): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || key === "page") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, value);
    }
  }

  search.set("page", String(page));
  return pathname + "?" + search.toString();
}

export function buildCatalogFilterHref(pathname: string, values: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, value);
    }
  }
  return search.toString() ? pathname + "?" + search.toString() : pathname;
}
