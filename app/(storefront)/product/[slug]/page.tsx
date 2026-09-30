import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getPublicProductSeoMetadata } from "@/lib/catalog/seo";
import {
  getStorefrontProduct,
  getStorefrontProductSeoInput,
  getStorefrontRelatedProducts,
} from "@/lib/storefront/catalog";
import { ProductDetail } from "@/components/storefront/product-detail";

type Params = Promise<{ slug: string }>;

async function loadProduct(slug: string) {
  try {
    return await getStorefrontProduct(slug);
  } catch (error) {
    if (error instanceof CatalogServiceError && (error.code === "PRODUCT_NOT_FOUND" || error.code === "INVALID_QUERY")) notFound();
    throw error;
  }
}

export const loadProductForRequest = cache(async (slug: string) => loadProduct(slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const product = await loadProductForRequest((await params).slug);
    const seo = getPublicProductSeoMetadata(getStorefrontProductSeoInput(product));
    if (!seo) return { robots: { index: false, follow: true } };

    return {
      title: seo.title,
      description: seo.description,
      alternates: { canonical: seo.canonicalUrl },
      robots: seo.robots,
      openGraph: {
        title: seo.title,
        description: seo.description,
        url: seo.canonicalUrl,
        type: "website",
      },
    };
  } catch (error) {
    if (error instanceof CatalogServiceError && error.code === "PRODUCT_NOT_FOUND") notFound();
    throw error;
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await loadProductForRequest((await params).slug);
  const relatedProducts = await getStorefrontRelatedProducts(product);
  return <ProductDetail product={product} relatedProducts={relatedProducts} />;
}
