import Image from "next/image";
import Link from "next/link";
import type { StorefrontProductDetail } from "@/lib/storefront/catalog";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/layout/container";

const availabilityLabel = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Limited availability",
  OUT_OF_STOCK: "Out of stock",
  UNTRACKED: "Available",
} as const;

export function ProductDetail({ product }: { product: StorefrontProductDetail }) {
  return (
    <Container className="py-10 sm:py-14 lg:py-20">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm font-700 uppercase">
        <Link href="/shop" className="motion-link">Shop</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:gap-14">
        <section aria-label="Product media" className="grid gap-5 sm:grid-cols-2">
          {product.media.map((media) => (
            <figure key={media.id} className="overflow-hidden border-2 border-border bg-white shadow-hard-md lg:border-4 lg:shadow-hard-lg">
              <div className="relative aspect-[4/5]"><Image src={media.url} alt={media.altText ?? product.title} fill sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover" /></div>
            </figure>
          ))}
          {!product.media.length ? (
            <div className="flex aspect-[4/5] items-center justify-center border-2 border-border bg-primary-yellow p-8 text-center font-900 uppercase shadow-hard-md lg:border-4 lg:shadow-hard-lg">
              Image coming soon
            </div>
          ) : null}
        </section>

        <section aria-labelledby="product-title" className="self-start lg:sticky lg:top-8">
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Product</p>
          <h1 id="product-title" className="mt-3 uppercase">{product.title}</h1>
          {product.shortDescription ? <p className="mt-5 text-lg">{product.shortDescription}</p> : null}

          <div className="mt-7 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-900">{product.currency} {product.price}</span>
            {product.compareAtPrice ? <span className="text-sm line-through">{product.currency} {product.compareAtPrice}</span> : null}
          </div>

          <div className="mt-4">
            <Badge variant={product.availability.state === "OUT_OF_STOCK" ? "outline" : "yellow"}>
              {availabilityLabel[product.availability.state]}
            </Badge>
          </div>

          {product.description ? <div className="mt-8 border-t-2 border-border pt-6 lg:border-t-4"><p>{product.description}</p></div> : null}

          {product.options.length ? (
            <section aria-labelledby="product-options" className="mt-8 border-t-2 border-border pt-6 lg:border-t-4">
              <h2 id="product-options" className="text-xl uppercase">Options</h2>
              <div className="mt-5 grid gap-5">
                {product.options.map((option) => (
                  <div key={option.id}>
                    <h3 className="text-base uppercase">{option.name}</h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {option.values.map((value) => (
                        <li key={value.id}><span className="inline-flex border-2 border-border bg-white px-3 py-2 text-sm font-700">{value.displayName}</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="product-variants" className="mt-8 border-t-2 border-border pt-6 lg:border-t-4">
            <h2 id="product-variants" className="text-xl uppercase">Available variants</h2>
            <ul className="mt-5 grid gap-4">
              {product.variants.map((variant) => (
                <li key={variant.id} className="border-2 border-border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-900">{variant.displayName ?? ([variant.size, variant.color].filter(Boolean).join(" / ") || "Variant")}</p>
                      <p className="mt-1 text-sm">{variant.price === product.price ? "Base price" : product.currency + " " + variant.price}</p>
                    </div>
                    <Badge variant={variant.availability.state === "OUT_OF_STOCK" ? "outline" : "yellow"}>
                      {availabilityLabel[variant.availability.state]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </section>
      </div>
    </Container>
  );
}
