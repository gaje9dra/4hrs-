import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductGrid } from "@/components/storefront/product-grid";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import { getStorefrontProducts } from "@/lib/storefront/catalog";
import { buildCatalogHref, catalogQueryFromSearchParams, type StorefrontSearchParams } from "@/lib/storefront/query-params";

export const metadata: Metadata = {
  title: "Shop | 4HRS",
  description: "Browse the public 4HRS catalog.",
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<StorefrontSearchParams> }) {
  const params = await searchParams;
  const products = await getStorefrontProducts(catalogQueryFromSearchParams(params));

  return (
    <Container className="py-10 sm:py-14 lg:py-20">
      <header className="mb-10 grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-end">
        <div>
          <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Catalog / Shop</p>
          <h1 className="mt-3 uppercase">Shop</h1>
        </div>
        <p className="max-w-2xl text-base lg:text-lg">Published products only. Filtering, sorting, availability, pricing, and pagination are resolved by the canonical catalog query service.</p>
      </header>
      <ProductGrid products={products.items} />
      <CatalogPagination pagination={products.pagination} buildHref={(page) => buildCatalogHref("/shop", params, page)} />
    </Container>
  );
}
