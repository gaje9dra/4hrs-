import Link from "next/link";
import type { StorefrontProductCard, StorefrontProductDetail } from "@/lib/storefront/catalog";
import { Container } from "@/components/layout/container";
import { ProductDetailInteractive } from "@/components/storefront/product-detail-interactive";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ProductDetailSections } from "@/components/storefront/product-detail-sections";

export function ProductDetail({
  product,
  relatedProducts = [],
}: {
  product: StorefrontProductDetail;
  relatedProducts?: StorefrontProductCard[];
}) {
  const collectionContext = [...product.collections].sort((a, b) => a.slug.localeCompare(b.slug))[0];
  const categoryContext = [...product.categories].sort((a, b) => a.slug.localeCompare(b.slug))[0];

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm font-700 uppercase">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li><Link href="/" className="motion-link">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/shop" className="motion-link">Shop</Link></li>
          {collectionContext ? (
            <>
              <li aria-hidden="true">/</li>
              <li><Link href={"/collections/" + collectionContext.slug} className="motion-link">{collectionContext.name}</Link></li>
            </>
          ) : null}
          {categoryContext ? (
            <>
              <li aria-hidden="true">/</li>
              <li><Link href={"/categories/" + categoryContext.slug} className="motion-link">{categoryContext.name}</Link></li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li aria-current="page">{product.title}</li>
        </ol>
      </nav>

      <ProductDetailInteractive product={product} />

      <ProductDetailSections product={product} />

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
