import type { CatalogQuery, CatalogSort } from "@/lib/catalog/query";

export type StorefrontSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const sorts = new Set<CatalogSort>([
  "newest", "oldest", "price_asc", "price_desc", "title_asc", "title_desc", "updated", "merchandising",
]);

export function catalogQueryFromSearchParams(params: StorefrontSearchParams): CatalogQuery {
  const sortValue = first(params.sort);
  const sort = sortValue && sorts.has(sortValue as CatalogSort) ? sortValue as CatalogSort : undefined;
  const tags = (first(params.tags) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const inStockValue = first(params.inStock);
  return {
    tags: tags.length ? tags : undefined,
    tagMode: first(params.tagMode) === "OR" ? "OR" : undefined,
    minPrice: first(params.minPrice),
    maxPrice: first(params.maxPrice),
    inStock: inStockValue === "true" ? true : undefined,
    sort,
    page: positiveInteger(first(params.page)),
    pageSize: positiveInteger(first(params.pageSize)),
  };
}

export function buildCatalogHref(pathname: string, params: StorefrontSearchParams, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, value);
    }
  }
  search.set("page", String(page));
  return pathname + "?" + search.toString();
}
