"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { StorefrontProductCard } from "@/lib/storefront/catalog";

type HomepageProductHeroCarouselProps = {
  products: StorefrontProductCard[];
};

export function HomepageProductHeroCarousel({ products }: HomepageProductHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (products.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % products.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [products.length]);

  if (!products.length) return null;

  const activeProduct = products[activeIndex] ?? products[0];

  return (
    <div className="absolute inset-10 z-10 overflow-visible sm:inset-14 lg:inset-16">
      <div className="absolute inset-0 overflow-hidden border-4 border-border bg-white shadow-hard-md">
        <Link
          href={activeProduct.href}
          aria-label={`View ${activeProduct.title}`}
          className="absolute inset-0 block focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-primary-blue"
        >
          {activeProduct.image ? (
            <Image
              key={activeProduct.id}
              src={activeProduct.image.url}
              alt={activeProduct.image.altText ?? activeProduct.title}
              fill
              priority={activeIndex === 0}
              sizes="(max-width: 639px) calc(100vw - 5rem), (max-width: 1024px) 80vw, (max-width: 1535px) 42vw, 620px"
              className="object-contain p-3 sm:p-5"
            />
          ) : null}
        </Link>
      </div>

      <Link
        href={activeProduct.href}
        aria-label={`Shop ${activeProduct.title}`}
        className="motion-link absolute -bottom-6 -right-6 z-20 inline-flex min-h-16 min-w-32 items-center justify-center gap-2 border-4 border-border bg-white px-4 py-3 text-sm font-900 uppercase tracking-[.06em] text-foreground shadow-hard-sm no-underline transition-colors hover:bg-primary-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:-bottom-7 sm:-right-7 sm:min-h-20 sm:min-w-40 sm:px-5 sm:text-base"
      >
        Shop <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}
