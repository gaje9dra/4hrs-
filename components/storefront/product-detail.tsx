import Link from "next/link";
import type { StorefrontProductCard, StorefrontProductDetail } from "@/lib/storefront/catalog";
import { Container } from "@/components/layout/container";
import { ProductDetailInteractive } from "@/components/storefront/product-detail-interactive";
import { ProductGrid } from "@/components/storefront/product-grid";

export function ProductDetail({
  product,
  relatedProducts = [],
}: {
  product: StorefrontProductDetail;
  relatedProducts?: StorefrontProductCard[];
}) {
  const collectionContext = product.collections[0];
  const categoryContext = product.categories[0];
  const context = collectionContext ?? categoryContext;

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm font-700 uppercase">
        <Link href="/" className="motion-link">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/shop" className="motion-link">Shop</Link>
        {context ? (
          <>
            <span aria-hidden="true"> / </span>
            <Link
              href={collectionContext ? "/collections/" + context.slug : "/categories/" + context.slug}
              className="motion-link"
            >
              {context.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{product.title}</span>
      </nav>

      <ProductDetailInteractive product={product} />

      {product.description ? (
        <section aria-labelledby="product-description" className="mt-12 border-t-4 border-border pt-8 lg:mt-16">
          <div className="grid gap-6 lg:grid-cols-[.35fr_1fr]">
            <h2 id="product-description" className="text-2xl uppercase">Details</h2>
            <p className="max-w-3xl text-lg leading-relaxed">{product.description}</p>
          </div>
        </section>
      ) : null}

      {relatedProducts.length ? (
        <section aria-labelledby="related-products" className="mt-12 border-t-4 border-border pt-8 lg:mt-16">
          <div className="mb-6">
            <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Curated discovery</p>
            <h2 id="related-products" className="mt-2 text-2xl uppercase">More from this context</h2>
          </div>
          <ProductGrid products={relatedProducts} />
        </section>
      ) : null}
    </Container>
  );
}
