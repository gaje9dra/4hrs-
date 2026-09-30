'use client';

import { useState } from "react";
import type { StorefrontProductDetail } from "@/lib/storefront/catalog";
import { Badge } from "@/components/ui/badge";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductOptions } from "@/components/storefront/product-options";
import { getDeterministicInitialVariant } from "@/lib/storefront/variant-selection";

const availabilityLabel = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Limited availability",
  OUT_OF_STOCK: "Out of stock",
  UNTRACKED: "Available",
} as const;

export function ProductDetailInteractive({ product }: { product: StorefrontProductDetail }) {
  const initialVariant = getDeterministicInitialVariant(product);
  const [variantMedia, setVariantMedia] = useState(
    initialVariant?.media.length ? initialVariant.media : product.media,
  );
  const availability = product.availability;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:gap-14">
      <section aria-label="Product media">
        <ProductGallery product={product} mediaOverride={variantMedia} />
      </section>

      <section aria-labelledby="product-title" className="self-start lg:sticky lg:top-8">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Product</p>
        <h1 id="product-title" className="mt-3 uppercase">{product.title}</h1>
        {product.shortDescription ? <p className="mt-5 text-lg">{product.shortDescription}</p> : null}

        <div className="mt-5">
          <Badge variant={availability.state === "OUT_OF_STOCK" ? "outline" : "yellow"}>
            {availabilityLabel[availability.state]}
          </Badge>
        </div>

        <section
          aria-labelledby={product.options.length ? "product-options" : undefined}
          aria-label={product.options.length ? undefined : "Product pricing and availability"}
          className="mt-8 border-t-2 border-border pt-6 lg:border-t-4"
        >
          {product.options.length ? <h2 id="product-options" className="mb-5 text-xl uppercase">Options</h2> : null}
          <ProductOptions product={product} onMediaChange={setVariantMedia} />
        </section>

        {product.categories.length || product.collections.length ? (
          <div className="mt-8 border-t-2 border-border pt-6 lg:border-t-4">
            <p className="text-xs font-900 uppercase tracking-[.2em]">Catalog context</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.categories.map((category) => (
                <span key={category.id} className="border-2 border-border bg-white px-3 py-2 text-xs font-800 uppercase">{category.name}</span>
              ))}
              {product.collections.map((collection) => (
                <span key={collection.id} className="border-2 border-border bg-primary-yellow px-3 py-2 text-xs font-800 uppercase">{collection.name}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
