import { db } from "@/lib/db/client";

export type CatalogQualityFinding = {
  productId: string;
  slug: string;
  issue: "MISSING_TITLE" | "MISSING_DESCRIPTION" | "MISSING_IMAGE" | "MISSING_CATEGORY" | "INVALID_VARIANT";
  severity: "WARNING" | "ERROR";
};

export async function getCatalogQualityFindings(limit = 200): Promise<CatalogQualityFinding[]> {
  const bounded = Math.max(1, Math.min(500, Math.trunc(limit)));
  const products = await db.product.findMany({
    where: { status: "ACTIVE" },
    take: bounded,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    select: {
      id: true, slug: true, title: true, description: true,
      images: { select: { id: true }, take: 1 },
      categories: { where: { category: { status: "ACTIVE" } }, select: { categoryId: true }, take: 1 },
      variants: { select: { id: true, sku: true, status: true }, take: 100 },
    },
  });

  const findings: CatalogQualityFinding[] = [];
  for (const product of products) {
    if (!product.title.trim()) findings.push({ productId: product.id, slug: product.slug, issue: "MISSING_TITLE", severity: "ERROR" });
    if (!product.description?.trim()) findings.push({ productId: product.id, slug: product.slug, issue: "MISSING_DESCRIPTION", severity: "WARNING" });
    if (!product.images.length) findings.push({ productId: product.id, slug: product.slug, issue: "MISSING_IMAGE", severity: "WARNING" });
    if (!product.categories.length) findings.push({ productId: product.id, slug: product.slug, issue: "MISSING_CATEGORY", severity: "ERROR" });
    if (product.variants.some((variant) => !variant.sku.trim())) findings.push({ productId: product.id, slug: product.slug, issue: "INVALID_VARIANT", severity: "ERROR" });
  }
  return findings;
}
