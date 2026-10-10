import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { getProductionSiteOrigin } from "@/config/site";
import { categoryPath, collectionPath, productPath } from "@/lib/catalog/routes";

const SITEMAP_PAGE_SIZE = 1000;
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getProductionSiteOrigin().toString().replace(/\/$/, "");
  const [products, categories, collections, content] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", title: { not: "" }, slug: { not: "" }, currency: { not: "" }, price: { gte: 0 } },
      orderBy: { slug: "asc" }, take: SITEMAP_PAGE_SIZE, select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({
      where: { status: "ACTIVE", products: { some: { product: { status: "ACTIVE", title: { not: "" }, slug: { not: "" } } } } },
      orderBy: { slug: "asc" }, take: SITEMAP_PAGE_SIZE, select: { slug: true, updatedAt: true },
    }),
    db.collection.findMany({
      where: { status: "ACTIVE", products: { some: { product: { status: "ACTIVE", title: { not: "" }, slug: { not: "" } } } } },
      orderBy: { slug: "asc" }, take: SITEMAP_PAGE_SIZE, select: { slug: true, updatedAt: true },
    }),
    db.contentItem.findMany({
      where: {
        type: "LANDING_PAGE",
        status: "PUBLISHED",
        publishedAt: { not: null },
        publishedVersion: { not: null },
        slug: { not: null },
        robots: { not: "noindex,nofollow" },
        OR: [{ publicationStartAt: null }, { publicationStartAt: { lte: new Date() } }],
        AND: [{ OR: [{ publicationEndAt: null }, { publicationEndAt: { gt: new Date() } }] }],
      },
      orderBy: { slug: "asc" },
      take: SITEMAP_PAGE_SIZE,
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return [
    { url: base + "/", changeFrequency: "daily", priority: 1 },
    { url: base + "/shop", changeFrequency: "daily", priority: 0.8 },
    ...[
      ["refund-replacement", 0.4],
      ["shipping", 0.4],
      ["terms", 0.3],
      ["privacy", 0.3],
      ["cancellation", 0.3],
      ["contact", 0.4],
      ["faq", 0.5],
    ].map(([path, priority]) => ({
      url: base + "/" + path,
      changeFrequency: "monthly" as const,
      priority: Number(priority),
    })),
    ...products.map((item) => ({ url: base + productPath(item), lastModified: item.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...categories.map((item) => ({ url: base + categoryPath(item), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((item) => ({ url: base + collectionPath(item), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...content.flatMap((item) => item.slug ? [{ url: base + "/content/" + encodeURIComponent(item.slug), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 }] : []),
  ];
}
