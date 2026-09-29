import type { StorefrontProductCard } from "@/lib/storefront/catalog";
import { ProductCard } from "@/components/storefront/product-card";

export function ProductGrid({ products }: { products: StorefrontProductCard[] }) {
  if (!products.length) {
    return (
      <div className="border-2 border-border bg-white p-8 text-center shadow-hard-md lg:border-4">
        <h2 className="text-2xl uppercase">No products found</h2>
        <p className="mt-3 text-sm">Try another category, collection, filter, or search term.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}
