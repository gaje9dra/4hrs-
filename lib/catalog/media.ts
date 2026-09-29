import type { ProductMediaType } from "@prisma/client";

export type CatalogMediaType = ProductMediaType;

export type CatalogMediaDto = {
  id: string;
  productId: string | null;
  variantId: string | null;
  url: string;
  storageReference: string | null;
  mediaType: CatalogMediaType;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaUploadInput = {
  body: Blob;
  filename: string;
  contentType: string;
};

export type MediaStorageMetadata = {
  contentType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
};

export interface MediaStorage {
  upload(input: MediaUploadInput): Promise<{ storageReference: string; metadata?: MediaStorageMetadata }>;
  resolveUrl(storageReference: string): Promise<string>;
  delete(storageReference: string): Promise<void>;
  exists(storageReference: string): Promise<boolean>;
  getMetadata?(storageReference: string): Promise<MediaStorageMetadata | null>;
}

export const CATALOG_MEDIA_ALT_TEXT_MAX_LENGTH = 200;
export const CATALOG_MEDIA_STORAGE_REFERENCE_MAX_LENGTH = 1024;

export function toCatalogMediaDto(input: CatalogMediaDto): CatalogMediaDto {
  return { ...input };
}
