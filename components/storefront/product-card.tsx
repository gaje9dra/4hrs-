import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StorefrontProductCard } from "@/lib/storefront/catalog";
import { productPath } from "@/lib/catalog/routes";
import { formatCatalogMoney } from "@/lib/storefront/money";

const availabilityLabel: Record<StorefrontProductCard["availability"], string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  UNTRACKED: "Available",
};

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  const href = productPath(product);
  const unavailable = product.availability === "OUT_OF_STOCK";

  return (
    <Card className="overflow-hidden p-0">
      <Link href={href} className="motion-link block no-underline">
        <div className="relative aspect-[4/5] overflow-hidden border-b-2 border-border bg-white lg:border-b-4">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.altText ?? product.title}
              fill
              loading="lazy"
              sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, (max-width: 1535px) 25vw, 320px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-primary-yellow p-6 text-center text-sm font-900 uppercase">
              Image coming soon
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} className="min-w-0 no-underline hover:no-underline">
            <h3 className="text-xl font-900 uppercase leading-tight">{product.title}</h3>
          </Link>
          <Badge variant={unavailable ? "outline" : "yellow"}>
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

        <div className="grid grid-cols-2 gap-2 border-t-2 border-border pt-4">
          <Button
            href={unavailable ? undefined : `${href}?intent=buy`}
            variant="primary"
            className="min-h-11 px-2 text-xs tracking-wide"
            aria-label={`Buy now: ${product.title}`}
            aria-disabled={unavailable || undefined}
          >
            Buy now
          </Button>
          <Button
            href={unavailable ? undefined : `${href}?intent=cart`}
            variant="yellow"
            className="min-h-11 px-2 text-xs tracking-wide"
            aria-label={`Add ${product.title} to cart`}
            aria-disabled={unavailable || undefined}
          >
            Add to cart
          </Button>
        </div>
      </div>
    </Card>
  );
}
