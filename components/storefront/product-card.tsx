import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, ShoppingCart } from "lucide-react";
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
    <Card className="group overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-1">
      <Link href={href} className="motion-link block no-underline" aria-label={product.title}>
        <div className="relative aspect-[4/5] overflow-hidden border-b-2 border-border bg-white lg:border-b-4">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.altText ?? product.title}
              fill
              loading="lazy"
              sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, (max-width: 1535px) 25vw, 320px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-primary-yellow p-6 text-center text-sm font-900 uppercase">
              Image coming soon
            </div>
          )}
        </div>
      </Link>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.68rem] font-800 uppercase tracking-[0.16em] text-primary-blue">
            4HRS+
          </span>
          <Badge
            variant={unavailable ? "outline" : "yellow"}
            className="shrink-0 whitespace-nowrap tracking-[0.08em]"
          >
            {availabilityLabel[product.availability]}
          </Badge>
        </div>

        <Link href={href} className="mt-3 block no-underline hover:no-underline">
          <h3 className="line-clamp-2 min-h-[3.25rem] text-[1.15rem] font-900 uppercase leading-[1.08] tracking-tight">
            {product.title}
          </h3>
        </Link>

        <div className="mt-4 flex items-baseline gap-2 border-t-2 border-border pt-4">
          <span className="text-lg font-900 leading-none">
            {formatCatalogMoney(product.price, product.currency)}
          </span>
          {product.compareAtPrice ? (
            <span
              className="text-sm leading-none text-muted-foreground line-through"
              aria-label="Compare-at price"
            >
              {formatCatalogMoney(product.compareAtPrice, product.currency)}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            href={unavailable ? undefined : `${href}?intent=buy`}
            variant="primary"
            className="min-h-11 w-full px-2 text-[0.68rem] font-900 tracking-[0.08em] whitespace-nowrap"
            aria-label={`Buy now: ${product.title}`}
            aria-disabled={unavailable || undefined}
            disabled={unavailable}
          >
            <ShoppingBag size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Buy now</span>
          </Button>
          <Button
            href={unavailable ? undefined : `${href}?intent=cart`}
            variant="yellow"
            className="min-h-11 w-full px-2 text-[0.68rem] font-900 tracking-[0.06em] whitespace-nowrap"
            aria-label={`Add ${product.title} to cart`}
            aria-disabled={unavailable || undefined}
            disabled={unavailable}
          >
            <ShoppingCart size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Add to cart</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
