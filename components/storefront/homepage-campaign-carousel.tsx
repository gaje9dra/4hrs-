"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const banners = [
  { src: "/images/homepage-banners/4hrs-hero-banner.png", alt: "4HRS+ premium streetwear campaign", href: "/shop", eyebrow: "4HRS+ / NEW SEASON", title: "Streetwear, redefined.", accent: "redefined." },
  { src: "/images/homepage-banners/4hrs-men-banner.png", alt: "Shop men's streetwear", href: "/category/men", eyebrow: "THE MEN'S EDIT", title: "Built for everyday.", accent: "everyday." },
  { src: "/images/homepage-banners/4hrs-women-banner.png", alt: "Shop women's streetwear", href: "/category/women", eyebrow: "THE WOMEN'S EDIT", title: "Make it your own.", accent: "your own." },
  { src: "/images/homepage-banners/4hrs-new-collection-banner.png", alt: "Explore the new 4HRS+ collection", href: "/shop", eyebrow: "JUST DROPPED", title: "Fresh designs. Same attitude.", accent: "Same attitude." },
  { src: "/images/homepage-banners/4hrs-sale-banner.png", alt: "Shop 4HRS+ sale styles", href: "/shop", eyebrow: "LIMITED-TIME OFFER", title: "Your next fit costs less.", accent: "costs less." },
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
    <section aria-label="Featured 4HRS+ campaigns" className="w-full border-b-2 border-border bg-[#f5f1e8] lg:border-b-4">
      <div
        className="relative w-full overflow-hidden bg-[#f5f1e8] sm:aspect-[1507/404]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Mobile editorial composition: copy and artwork are arranged for a narrow viewport. */}
        <div className="relative isolate flex min-h-[330px] flex-col overflow-hidden sm:hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[#f5f1e8]" />
          <div className="relative z-10 px-5 pb-0 pt-5">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary-blue">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-primary-red" />
              {activeBanner.eyebrow}
            </p>
            <h2 className="max-w-[19ch] text-[clamp(1.65rem,7vw,2.35rem)] font-black uppercase leading-[0.92] tracking-[-0.055em] text-[#171717]">
              {activeBanner.title.replace(activeBanner.accent, "")}
              <span className="text-primary-red">{activeBanner.accent}</span>
            </h2>
            <Link
              href={activeBanner.href}
              className="mt-3 inline-flex min-h-9 items-center gap-2 bg-[#171717] px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white no-underline"
            >
              Shop now <span aria-hidden="true">→</span>
            </Link>
          </div>

          <Link href={activeBanner.href} aria-label={activeBanner.alt} className="relative mt-2 block h-[190px] w-full overflow-hidden">
            <Image
              key={activeBanner.src}
              src={activeBanner.src}
              alt=""
              fill
              priority={activeIndex === 0}
              sizes="100vw"
              className="object-cover object-[72%_center]"
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f5f1e8] via-[#f5f1e8]/75 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[24%] bg-gradient-to-l from-[#f5f1e8]/10 to-transparent" />
          </Link>
        </div>

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

        <button type="button" onClick={showPrevious} aria-label="Previous campaign" className="absolute left-2 top-[68%] z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:left-5 sm:top-1/2 sm:h-11 sm:w-11 sm:border-2">
          <ChevronLeft size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
        </button>
        <button type="button" onClick={showNext} aria-label="Next campaign" className="absolute right-2 top-[68%] z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:right-5 sm:top-1/2 sm:h-11 sm:w-11 sm:border-2">
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
