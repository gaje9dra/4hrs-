import { absoluteSiteUrl, siteConfig } from "@/config/site";

export type JsonLd = Record<string, unknown>;

export function serializeJsonLd(value: JsonLd): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function jsonLdScript(value: JsonLd) {
  return { type: "application/ld+json" as const, dangerouslySetInnerHTML: { __html: serializeJsonLd(value) } };
}

export function organizationJsonLd(): JsonLd {
  return { "@context": "https://schema.org", "@type": "Organization", name: siteConfig.name, url: absoluteSiteUrl("/") };
}

export function websiteJsonLd(): JsonLd {
  return { "@context": "https://schema.org", "@type": "WebSite", name: siteConfig.name, url: absoluteSiteUrl("/") };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

function absoluteMediaUrl(value: string): string | null {
  try {
    const url = new URL(value, absoluteSiteUrl("/"));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function productJsonLd(input: {
  name: string; description: string; url: string; imageUrls: string[];
  price: string; currency: string; sku?: string;
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED";
}): JsonLd {
  const availabilityMap = {
    IN_STOCK: "https://schema.org/InStock",
    LOW_STOCK: "https://schema.org/LimitedAvailability",
    OUT_OF_STOCK: "https://schema.org/OutOfStock",
    UNTRACKED: undefined,
  } as const;
  const offers: Record<string, unknown> = {
    "@type": "Offer", url: input.url, price: input.price, priceCurrency: input.currency,
  };
  if (availabilityMap[input.availability]) offers.availability = availabilityMap[input.availability];
  const images = input.imageUrls.map(absoluteMediaUrl).filter((url): url is string => Boolean(url));
  return {
    "@context": "https://schema.org", "@type": "Product", name: input.name,
    description: input.description, url: input.url,\n    ...(input.sku ? { sku: input.sku } : {}),
    ...(images.length ? { image: images } : {}),
    brand: { "@type": "Brand", name: siteConfig.name }, offers,
  };
}
