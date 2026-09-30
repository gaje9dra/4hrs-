import type { CatalogAppliedQuery } from "@/lib/catalog/query";

export type CatalogSurface = "shop" | "category" | "collection" | "search";
export type CatalogErrorClassification =
  | "invalid_query"
  | "not_found"
  | "catalog_data_integrity"
  | "database_failure"
  | "unexpected_application_failure"
  | "slow_search";

export type CatalogObservation = {
  surface: CatalogSurface;
  operation: string;
  classification: CatalogErrorClassification;
  durationMs?: number;
  query?: Partial<Pick<CatalogAppliedQuery, "category" | "collection" | "tags" | "tagMode" | "minPrice" | "maxPrice" | "inStock" | "sort" | "page" | "pageSize">>;
};

export function logCatalogObservation(observation: CatalogObservation): void {
  const payload = {
    event: "catalog_observation",
    surface: observation.surface,
    operation: observation.operation,
    classification: observation.classification,
    durationMs: observation.durationMs === undefined ? undefined : Math.round(observation.durationMs),
    query: observation.query
      ? {
          category: observation.query.category,
          collection: observation.query.collection,
          tags: observation.query.tags,
          tagMode: observation.query.tagMode,
          minPrice: observation.query.minPrice,
          maxPrice: observation.query.maxPrice,
          inStock: observation.query.inStock,
          sort: observation.query.sort,
          page: observation.query.page,
          pageSize: observation.query.pageSize,
        }
      : undefined,
  };

  if (
    observation.classification === "database_failure" ||
    observation.classification === "catalog_data_integrity" ||
    observation.classification === "unexpected_application_failure"
  ) {
    console.error(JSON.stringify(payload));
  } else if (observation.classification === "invalid_query") {
    console.warn(JSON.stringify(payload));
  } else if (observation.classification === "not_found" || observation.classification === "slow_search") {
    console.info(JSON.stringify(payload));
  }
}
