"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const banners = [
  {
    src: "/images/homepage-banners/4hrs-hero-banner.png",
    mobileSrc: "/images/homepage-banners/4hrs-hero-banner.png",
    alt: "4HRS+ premium streetwear campaign",
    mobileTitle: "Streetwear, redefined.",
    mobileEyebrow: "4HRS+ / NEW SEASON",
    href: "/shop",
    mobileBg: "bg-[#f5f1e8]",
  },
  {
    src: "/images/homepage-banners/4hrs-men-banner.png",
    mobileSrc: "/images/homepage-banners/4hrs-men-banner.png",
    alt: "Shop men's streetwear",
    mobileTitle: "Built for everyday.",
    mobileEyebrow: "THE MEN'S EDIT",
    href: "/category/men",
    mobileBg: "bg-[#f5f1e8]",
  },
  {
    src: "/images/homepage-banners/4hrs-women-banner.png",
    mobileSrc: "/images/homepage-banners/4hrs-women-banner.png",
    alt: "Shop women's streetwear",
    mobileTitle: "Make it your own.",
    mobileEyebrow: "THE WOMEN'S EDIT",
    href: "/category/women",
    mobileBg: "bg-[#f5f1e8]",
  },
  {
    src: "/images/homepage-banners/4hrs-new-collection-banner.png",
    mobileSrc: "/images/homepage-banners/4hrs-new-collection-banner.png",
    alt: "Explore the new 4HRS+ collection",
    mobileTitle: "Fresh designs. Same attitude.",
    mobileEyebrow: "JUST DROPPED",
    href: "/shop",
    mobileBg: "bg-[#f5f1e8]",
  },
  {
    src: "/images/homepage-banners/4hrs-sale-banner.png",
    mobileSrc: "/images/homepage-banners/4hrs-sale-banner.png",
    alt: "Shop 4HRS+ sale styles",
    mobileTitle: "Your next fit costs less.",
    mobileEyebrow: "LIMITED-TIME OFFER",
    href: "/shop",
    mobileBg: "bg-[#f5f1e8]",
  },
];

export function HomepageCampaignCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const activeBanner = banners[activeIndex];

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + banners.length) % banners.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % banners.length);
  }

  return (
    <section aria-label="Featured 4HRS+ campaigns" className="w-full border-b-2 border-border bg-background lg:border-b-4">
      <div
        className="relative w-full overflow-hidden bg-[#f5f1e8] sm:aspect-[1507/404]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <Link
          href={activeBanner.href}
          aria-label={activeBanner.alt}
          className="group relative block min-h-[260px] w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary-blue sm:hidden"
        >
          <div className="relative flex min-h-[260px] flex-col">
            <div className="relative z-10 px-5 pb-2 pt-5">
              <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#1642bf]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#d9272e]" />
                {activeBanner.mobileEyebrow}
              </p>
              <h2 className="max-w-[22ch] text-2xl font-black uppercase leading-[0.92] tracking-[-0.045em] text-[#171717]">
                {activeBanner.mobileTitle}
              </h2>
              <span className="mt-3 inline-flex items-center gap-2 bg-[#171717] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
                Shop now <span aria-hidden="true">→</span>
              </span>
            </div>
            <div className="relative mt-1 h-[145px] w-full overflow-hidden">
              <Image
                key={activeBanner.mobileSrc}
                src={activeBanner.mobileSrc}
                alt=""
                fill
                sizes="100vw"
                priority={activeIndex === 0}
                className="object-cover object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#f5f1e8]/15 to-transparent" />
            </div>
          </div>
        </Link>

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

        <button
          type="button"
          onClick={showPrevious}
          aria-label="Previous campaign"
          className="absolute left-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:left-5 sm:h-11 sm:w-11 sm:border-2"
        >
          <ChevronLeft size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
        </button>
        <button
          type="button"
          onClick={showNext}
          aria-label="Next campaign"
          className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border bg-white/95 shadow-hard-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:right-5 sm:h-11 sm:w-11 sm:border-2"
        >
          <ChevronRight size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
        </button>

        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 border border-border/80 bg-white/90 px-2 py-1 shadow-hard-sm sm:bottom-4 sm:gap-2 sm:border-2 sm:px-3 sm:py-2">
          {banners.map((banner, index) => (
            <button
              key={banner.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show campaign ${index + 1}: ${banner.alt}`}
              aria-current={index === activeIndex ? "true" : undefined}
              className={`h-1.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue sm:h-2.5 ${index === activeIndex ? "w-5 bg-primary-red sm:w-7" : "w-1.5 bg-primary-blue/40 hover:bg-primary-blue sm:w-2.5"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
