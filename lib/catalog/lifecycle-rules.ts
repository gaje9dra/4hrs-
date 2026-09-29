import type { ProductStatus } from "@prisma/client";

export const PRODUCT_LIFECYCLE_TRANSITIONS: Readonly<Record<ProductStatus, readonly ProductStatus[]>> = {
  DRAFT: ["DRAFT", "ACTIVE", "ARCHIVED"],
  ACTIVE: ["ACTIVE", "DRAFT", "ARCHIVED"],
  ARCHIVED: ["ARCHIVED", "DRAFT"],
};

export function canTransitionProductStatus(from: ProductStatus, to: ProductStatus): boolean {
  return PRODUCT_LIFECYCLE_TRANSITIONS[from].includes(to);
}
