import type { CatalogQuery, CatalogSort } from "@/lib/catalog/query";

export type StorefrontSearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_CATALOG_SORT: CatalogSort = "newest";
export const DEFAULT_CATALOG_PAGE_SIZE = 24;
export const MAX_CATALOG_PAGE = 10000;
export const MAX_CATALOG_PAGE_SIZE = 100;
export const MAX_CATALOG_TAGS = 20;

const sorts = new Set<CatalogSort>([
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "title_asc",
  "title_desc",
  "updated",
  "merchandising",
]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function invalidParameter(name: string, reason: string): never {
  throw new Error("Invalid catalog query parameter: " + name + " (" + reason + ").");
}

function positiveInteger(value: string | undefined, name: string, max: number): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value)) invalidParameter(name, "must be a positive integer");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    invalidParameter(name, "must be an integer from 1 to " + max);
  }
  return parsed;
}

function money(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    invalidParameter(name, "must be a non-negative amount with at most two decimals");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return whole + "." + fraction.padEnd(2, "0");
}

function slug(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    invalidParameter(name, "must be a canonical catalog slug");
  }
  return normalized;
}

function booleanValue(value: string | undefined, name: string): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  if (value !== "true" && value !== "false") invalidParameter(name, "must be true or false");
  return value === "true";
}

export function catalogQueryFromSearchParams(params: StorefrontSearchParams): CatalogQuery {
  const sortValue = first(params.sort);
  const sort =
    sortValue === undefined || sortValue === ""
      ? undefined
      : sorts.has(sortValue as CatalogSort)
        ? (sortValue as CatalogSort)
        : invalidParameter("sort", "unsupported sort");

  const rawTags = all(params.tags);
  const tags = rawTags
    .flatMap((value) => value.split(","))
    .map((tag) => slug(tag, "tags"))
    .filter((tag): tag is string => Boolean(tag));
  const uniqueTags = [...new Set(tags)].sort();
  if (uniqueTags.length > MAX_CATALOG_TAGS) {
    invalidParameter("tags", "must contain no more than " + MAX_CATALOG_TAGS + " unique tags");
  }

  const tagModeValue = first(params.tagMode);
  const tagMode =
    tagModeValue === undefined || tagModeValue === ""
      ? undefined
      : tagModeValue === "AND" || tagModeValue === "OR"
        ? tagModeValue
        : invalidParameter("tagMode", "must be AND or OR");

  return {
    category: slug(first(params.category), "category"),
    collection: slug(first(params.collection), "collection"),
    tags: uniqueTags.length ? uniqueTags : undefined,
    tagMode: uniqueTags.length ? (tagMode ?? "AND") : "AND",
    minPrice: money(first(params.minPrice), "minPrice"),
    maxPrice: money(first(params.maxPrice), "maxPrice"),
    inStock: booleanValue(first(params.inStock), "inStock"),
    sort,
    page: positiveInteger(first(params.page), "page", MAX_CATALOG_PAGE),
    pageSize: positiveInteger(first(params.pageSize), "pageSize", MAX_CATALOG_PAGE_SIZE),
  };
}

function append(search: URLSearchParams, key: string, value: string | undefined): void {
  if (value !== undefined) search.set(key, value);
}

export function buildCatalogHref(pathname: string, params: StorefrontSearchParams, page: number): string {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("Catalog page must be a positive integer.");
  }

  const search = new URLSearchParams();
  const rawQuery = first(params.q);
  if (pathname === "/search" && rawQuery) search.set("q", rawQuery.trim().replace(/\s+/g, " "));
  const query = catalogQueryFromSearchParams(params);

  append(search, "category", query.category);
  append(search, "collection", query.collection);
  if (query.tags?.length) append(search, "tags", query.tags.join(","));
  if (query.tagMode && query.tagMode !== "AND") append(search, "tagMode", query.tagMode);
  append(search, "minPrice", query.minPrice);
  append(search, "maxPrice", query.maxPrice);
  if (query.inStock) append(search, "inStock", "true");
  if (query.sort && query.sort !== DEFAULT_CATALOG_SORT) append(search, "sort", query.sort);
  if (query.pageSize && query.pageSize !== DEFAULT_CATALOG_PAGE_SIZE) append(search, "pageSize", String(query.pageSize));
  if (page > 1) append(search, "page", String(page));

  const serialized = search.toString();
  return serialized ? pathname + "?" + serialized : pathname;
}

export function buildCatalogFilterHref(
  pathname: string,
  values: Record<string, string | string[] | undefined>,
): string {
  const search = new URLSearchParams();
  const rawQuery = first(values.q);
  if (pathname === "/search" && rawQuery) search.set("q", rawQuery.trim().replace(/\s+/g, " "));
  const query = catalogQueryFromSearchParams(values);

  append(search, "category", query.category);
  append(search, "collection", query.collection);
  if (query.tags?.length) append(search, "tags", query.tags.join(","));
  if (query.tagMode && query.tagMode !== "AND") append(search, "tagMode", query.tagMode);
  append(search, "minPrice", query.minPrice);
  append(search, "maxPrice", query.maxPrice);
  if (query.inStock) append(search, "inStock", "true");
  if (query.sort && query.sort !== DEFAULT_CATALOG_SORT) append(search, "sort", query.sort);
  if (query.pageSize && query.pageSize !== DEFAULT_CATALOG_PAGE_SIZE) append(search, "pageSize", String(query.pageSize));

  const serialized = search.toString();
  return serialized ? pathname + "?" + serialized : pathname;
}
