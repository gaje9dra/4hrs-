"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const banners = [
  { src: "/images/homepage-banners/4hrs-hero-banner.png", alt: "4HRS+ premium streetwear campaign", href: "/shop", eyebrow: "4HRS+ / NEW SEASON", title: "Streetwear, redefined.", accent: "redefined." },
  { src: "/images/homepage-banners/4hrs-men-banner.png", alt: "Shop men's streetwear", href: "/category/men", eyebrow: "THE MEN'S EDIT", title: "Built for everyday.", accent: "everyday." },
];

export function HomepageCampaignCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % banners.length), 4000);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const activeBanner = banners[activeIndex];
  const showPrevious = () => setActiveIndex((current) => (current - 1 + banners.length) % banners.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % banners.length);

  return (
    <section aria-label="Featured 4HRS+ campaigns" className="hidden w-full border-b-2 border-border bg-[#f5f1e8] lg:border-b-4 sm:block">
      <div
        className="relative w-full overflow-hidden bg-[#f5f1e8] sm:aspect-[1507/404]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Mobile: give the artwork the entire carousel area; no headline or CTA overlay. */}
        <Link
          href={activeBanner.href}
          aria-label={activeBanner.alt}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-[#f5f1e8] sm:hidden"
        >
          <Image
            key={activeBanner.src}
            src={activeBanner.src}
            alt={activeBanner.alt}
            fill
            priority={activeIndex === 0}
            sizes="100vw"
            className="object-cover object-center"
          />
        </Link>

        {/* Desktop keeps the original panoramic artwork intact. */}
        <Link
          href={activeBanner.href}
          aria-label={activeBanner.alt}
          className="group absolute inset-0 hidden focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary-blue sm:block"
        >
          <Image
            key={activeBanner.src}
            src={activeBanner.src}
            alt={activeBanner.alt}
            fill
            priority={activeIndex === 0}
            sizes="100vw"
            className="object-contain"
          />
        </Link>

        <button type="button" onClick={showPrevious} aria-label="Previous campaign" className="absolute left-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:left-5 sm:h-11 sm:w-11 sm:border-2">
          <ChevronLeft size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
        </button>
        <button type="button" onClick={showNext} aria-label="Next campaign" className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:right-5 sm:h-11 sm:w-11 sm:border-2">
          <ChevronRight size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
        </button>

        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 border border-border/70 bg-white/90 px-2 py-1 shadow-hard-sm sm:bottom-4 sm:gap-2 sm:border-2 sm:px-3 sm:py-2">
          {banners.map((banner, index) => (
            <button key={banner.src} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show campaign ${index + 1}: ${banner.alt}`} aria-current={index === activeIndex ? "true" : undefined} className={`h-1.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:h-2.5 ${index === activeIndex ? "w-5 bg-primary-red sm:w-7" : "w-1.5 bg-primary-blue/40 hover:bg-primary-blue sm:w-2.5"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
