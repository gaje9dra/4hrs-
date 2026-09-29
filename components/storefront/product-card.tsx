import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { StorefrontProductCard } from "@/lib/storefront/catalog";
import { productPath } from "@/lib/catalog/routes";
import { formatCatalogMoney } from "@/lib/storefront/money";

const availabilityLabel: Record<StorefrontProductCard["availability"], string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Limited",
  OUT_OF_STOCK: "Out of stock",
  UNTRACKED: "Available",
};

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  return (
    <Card className="overflow-hidden p-0">
      <Link href={productPath(product)} className="motion-link block no-underline">
        <div className="aspect-[4/5] overflow-hidden border-b-2 border-border bg-white lg:border-b-4">
          {product.image ? (
            <img
              src={product.image.url}
              alt={product.image.altText ?? product.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-primary-yellow p-6 text-center text-sm font-900 uppercase">
              Image coming soon
            </div>
          )}
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-900 uppercase leading-tight">{product.title}</h2>
            <Badge variant={product.availability === "OUT_OF_STOCK" ? "outline" : "yellow"}>
              {availabilityLabel[product.availability]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-900">{formatCatalogMoney(product.price, product.currency)}</span>
            {product.compareAtPrice ? (
              <span className="text-sm line-through" aria-label="Compare-at price">
                {formatCatalogMoney(product.compareAtPrice, product.currency)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </Card>
  );
}
