export type CatalogErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_ALREADY_EXISTS"
  | "INVALID_PRODUCT"
  | "INVALID_VARIANT"
  | "DUPLICATE_SKU"
  | "DUPLICATE_SLUG"
  | "VARIANT_NOT_FOUND"
  | "OPTION_TYPE_NOT_FOUND"
  | "OPTION_VALUE_NOT_FOUND"
  | "DUPLICATE_OPTION_TYPE"
  | "DUPLICATE_OPTION_VALUE"
  | "INVALID_CATEGORY"
  | "CATEGORY_NOT_FOUND"
  | "INVALID_COLLECTION"
  | "COLLECTION_NOT_FOUND"
  | "INVALID_TAG"
  | "TAG_NOT_FOUND"
  | "PRODUCT_NOT_PUBLISHABLE"
  | "INVALID_IMAGE_RELATIONSHIP"
  | "IMAGE_NOT_FOUND"
  | "RELATIONSHIP_NOT_FOUND"
  | "INVALID_STATUS"
  | "INVALID_QUERY"
  | "INVALID_SORT"
  | "INVALID_PAGE"
  | "INVALID_CURSOR"
  | "INVALID_PRICE_RANGE"
  | "CATALOG_DATABASE_ERROR";

export class CatalogServiceError extends Error {
  readonly code: CatalogErrorCode;
  readonly cause?: unknown;

  constructor(code: CatalogErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "CatalogServiceError";
    this.code = code;
    this.cause = cause;
  }
}
