"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/layout/container";

const banners = [
  { src: "/images/homepage-banners/4hrs-hero-banner.png", alt: "4HRS+ premium streetwear campaign", href: "/shop" },
  { src: "/images/homepage-banners/4hrs-men-banner.png", alt: "Shop men's streetwear", href: "/category/men" },
  { src: "/images/homepage-banners/4hrs-women-banner.png", alt: "Shop women's streetwear", href: "/category/women" },
  { src: "/images/homepage-banners/4hrs-new-collection-banner.png", alt: "Explore the new 4HRS+ collection", href: "/shop" },
  { src: "/images/homepage-banners/4hrs-sale-banner.png", alt: "Shop 4HRS+ sale styles", href: "/shop" },
];

export function HomepageCampaignCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const activeBanner = banners[activeIndex];

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + banners.length) % banners.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % banners.length);
  }

  return (
    <section aria-label="Featured 4HRS+ campaigns" className="border-b-2 border-border bg-background lg:border-b-4">
      <Container width="wide" className="py-3 sm:py-4">
        <div className="relative overflow-hidden border-2 border-border bg-white shadow-hard-md">
          <Link
            href={activeBanner.href}
            aria-label={activeBanner.alt}
            className="group relative block aspect-[3.72/1] min-h-[180px] w-full overflow-hidden sm:min-h-0"
          >
            <Image
              key={activeBanner.src}
              src={activeBanner.src}
              alt={activeBanner.alt}
              fill
              priority={activeIndex === 0}
              sizes="(max-width: 639px) 100vw, 100vw"
              className="object-cover transition-opacity duration-300"
            />
          </Link>

          <button
            type="button"
            onClick={showPrevious}
            aria-label="Previous campaign"
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border-2 border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:left-5 sm:h-12 sm:w-12"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="Next campaign"
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border-2 border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:right-5 sm:h-12 sm:w-12"
          >
            <ChevronRight size={24} strokeWidth={2.5} />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 border-2 border-border bg-white/95 px-3 py-2 shadow-hard-sm sm:bottom-5">
            {banners.map((banner, index) => (
              <button
                key={banner.src}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show campaign ${index + 1}: ${banner.alt}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`h-2.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue ${index === activeIndex ? "w-7 bg-primary-red" : "w-2.5 bg-primary-blue/40 hover:bg-primary-blue"}`}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
