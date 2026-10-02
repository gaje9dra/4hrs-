import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicProductSeoMetadata } from "@/lib/catalog/seo";
import { absoluteSiteUrl } from "@/config/site";
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd } from "@/lib/seo/structured-data";
import { getStorefrontProduct, getStorefrontProductSeoInput, getStorefrontRelatedProducts } from "@/lib/storefront/catalog";
import { ProductDetail } from "@/components/storefront/product-detail";

type Params = Promise<{ slug: string }>;
async function loadProduct(slug: string) { try { return await getStorefrontProduct(slug); } catch (error) { if (error instanceof CatalogServiceError && (error.code === "PRODUCT_NOT_FOUND" || error.code === "INVALID_QUERY")) notFound(); throw error; } }
export const loadProductForRequest = cache(async (slug: string) => loadProduct(slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await loadProductForRequest((await params).slug); const seo = getPublicProductSeoMetadata(getStorefrontProductSeoInput(product));
  if (!seo) return { robots: { index: false, follow: true } };
  const image = product.media[0]?.url;
  return { title: seo.title, description: seo.description, alternates: { canonical: seo.canonicalUrl }, robots: seo.robots, openGraph: { title: seo.title, description: seo.description, url: seo.canonicalUrl, type: "website", ...(image ? { images: [{ url: image, alt: product.media[0]?.altText ?? product.title }] } : {}) }, twitter: { card: "summary_large_image", title: seo.title, description: seo.description, ...(image ? { images: [image] } : {}) } };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await loadProductForRequest((await params).slug); const relatedProducts = await getStorefrontRelatedProducts(product);
  const canonical = absoluteSiteUrl("/product/" + encodeURIComponent(product.slug));
  const productSchema = productJsonLd({ name: product.title, description: product.shortDescription ?? product.description ?? product.title, url: canonical, imageUrls: product.media.map((item) => item.url), price: product.price, currency: product.currency, availability: product.availability.state });
  const breadcrumbs = breadcrumbJsonLd([{ name: "Home", url: absoluteSiteUrl("/") }, { name: "Shop", url: absoluteSiteUrl("/shop") }, ...(product.collections[0] ? [{ name: product.collections[0].name, url: absoluteSiteUrl("/collection/" + encodeURIComponent(product.collections[0].slug)) }] : []), ...(product.categories[0] ? [{ name: product.categories[0].name, url: absoluteSiteUrl("/category/" + encodeURIComponent(product.categories[0].slug)) }] : []), { name: product.title, url: canonical }]);
  return <><ProductDetail product={product} relatedProducts={relatedProducts} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} /></>;
}
