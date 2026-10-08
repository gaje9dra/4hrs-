import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { StorefrontProductCard } from "@/lib/storefront/catalog";
import { productPath } from "@/lib/catalog/routes";
import { formatCatalogMoney } from "@/lib/storefront/money";

function savingsPercent(product: StorefrontProductCard): number | null {
  if (!product.compareAtPrice) return null;
  const current = Number(product.price);
  const compareAt = Number(product.compareAtPrice);
  if (!Number.isFinite(current) || !Number.isFinite(compareAt) || compareAt <= current || compareAt <= 0) return null;
  return Math.round(((compareAt - current) / compareAt) * 100);
}

export function ProductCard({ product }: { product: StorefrontProductCard }) {
  const href = productPath(product);
  const unavailable = product.availability === "OUT_OF_STOCK";
  const savings = savingsPercent(product);

  return (
    <Card className="group overflow-hidden p-0 shadow-none transition-transform duration-200 hover:-translate-y-1 lg:shadow-hard-md">
      <div className="relative">
        <Link href={href} className="motion-link block no-underline" aria-label={product.title}>
          <div className="relative aspect-[4/5] overflow-hidden bg-white">
            {product.image ? (
              <Image
                src={product.image.url}
                alt={product.image.altText ?? product.title}
                fill
                loading="lazy"
                sizes="(max-width: 639px) 50vw, (max-width: 1024px) 33vw, (max-width: 1535px) 25vw, 320px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-primary-yellow p-6 text-center text-sm font-900 uppercase">
                Image coming soon
              </div>
            )}
          </div>
        </Link>

        {savings ? (
          <span className="absolute left-3 top-3 z-10 border-2 border-primary-red bg-primary-red px-2.5 py-1.5 text-[0.68rem] font-900 uppercase tracking-[0.05em] text-white">
            Save {savings}%
          </span>
        ) : null}

        <Link
          href={href}
          aria-label={`View ${product.title}`}
          className="motion-icon absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-circle border-2 border-border bg-white no-underline shadow-hard-sm hover:bg-primary-yellow"
        >
          <Heart size={19} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>

      <Link
        href={unavailable ? href : `${href}?intent=cart`}
        aria-disabled={unavailable || undefined}
        className="motion-press flex min-h-12 items-center justify-center gap-2 border-x-0 border-b-2 border-border bg-foreground px-4 py-3 text-xs font-900 uppercase tracking-[0.12em] text-white no-underline hover:bg-primary-blue hover:text-white lg:border-b-4"
      >
        <ShoppingCart size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>{unavailable ? "Out of stock" : "Add to cart"}</span>
      </Link>

      <div className="bg-white px-3 pb-4 pt-4 sm:px-4">
        <Link href={href} className="block no-underline hover:no-underline">
          <h3 className="line-clamp-2 min-h-[2.7rem] text-[0.98rem] font-900 uppercase leading-[1.12] tracking-[-0.01em]">
            {product.title}
          </h3>
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {product.compareAtPrice ? (
            <span className="text-sm leading-none text-muted-foreground line-through" aria-label="Original price">
              {formatCatalogMoney(product.compareAtPrice, product.currency)}
            </span>
          ) : null}
          <span className="text-base font-900 leading-none text-primary-red sm:text-lg">
            {formatCatalogMoney(product.price, product.currency)}
          </span>
        </div>
      </div>
    </Card>
  );
}
