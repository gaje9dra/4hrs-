import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/components/storefront/product-card";
import { Container } from "@/components/layout/container";
import { GeometricLayer } from "@/components/bauhaus/geometric-composition";
import { categoryPath, collectionPath } from "@/lib/catalog/routes";
import type { StorefrontHomeData } from "@/lib/storefront/catalog";
import { SectionHeading as SharedSectionHeading } from "@/components/ui/section-heading";
import { EditorialContent } from "@/components/storefront/editorial-content";
import { EditorialAnalytics } from "@/components/storefront/editorial-analytics";
import type { ContentSnapshot } from "@/lib/content/service";

function Hero({ data }: { data: StorefrontHomeData }) {
  const visualProduct = data.featuredProducts[0] ?? data.newArrivals[0];

  return (
    <section className="border-b-2 border-border lg:border-b-4" aria-labelledby="home-hero-title">
      <Container width="wide" className="grid min-h-[calc(100vh-76px)] items-stretch gap-8 py-8 sm:py-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-0 lg:py-10">
        <div className="relative z-10 flex flex-col justify-center border-2 border-border bg-primary-blue p-7 text-white shadow-hard-lg sm:p-10 lg:border-4 lg:p-14">
          <div className="mb-8 flex items-center gap-3 text-xs font-900 uppercase tracking-[.25em] text-primary-yellow">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-primary-red" />
            4HRS / Fashion / 01
          </div>
          <h1 id="home-hero-title" className="max-w-4xl uppercase leading-[.84] tracking-[-.055em]">
            Wear the<br /><span className="text-primary-yellow">geometry.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base font-500 leading-7 text-white/90 sm:text-lg">
            Fashion built around bold form, clear color and a deliberately graphic point of view.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Button href="/shop" variant="yellow">
              Shop the catalog <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="relative isolate min-h-[390px] overflow-hidden border-2 border-t-0 border-border bg-background shadow-hard-lg lg:min-h-full lg:border-4 lg:border-l-0 lg:border-t-4">
          <GeometricLayer layer="back" className="right-[-4rem] top-[-4rem] h-48 w-48 rounded-full bg-primary-red sm:h-64 sm:w-64" />
          <GeometricLayer layer="back" className="bottom-[-3rem] left-[-3rem] h-44 w-44 bg-primary-yellow sm:h-60 sm:w-60" />
          {visualProduct?.image ? (
            <div className="absolute inset-10 z-10 overflow-hidden border-4 border-border bg-white shadow-hard-md sm:inset-14 lg:inset-16">
              <Image
                src={visualProduct.image.url}
                alt={visualProduct.image.altText ?? visualProduct.title}
                fill
                priority
                sizes="(max-width: 639px) calc(100vw - 5rem), (max-width: 1024px) 80vw, (max-width: 1535px) 42vw, 620px"
                className="object-cover"
              />
            </div>
          ) : (
            <GeometricLayer layer="base" className="left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rotate-12 bg-primary-blue clip-triangle sm:h-56 sm:w-56" />
          )}
          <GeometricLayer layer="front" className="bottom-6 right-6 h-16 w-28 border-4 border-border bg-white shadow-hard-sm sm:h-24 sm:w-40" />
        </div>
      </Container>
    </section>
  );
}

function ProductDiscovery({
  title,
  eyebrow,
  products,
}: {
  title: string;
  eyebrow: string;
  products: StorefrontHomeData["newArrivals"];
}) {
  if (!products.length) return null;

  return (
    <section aria-labelledby="curated-products-title" className="border-b-2 border-border lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <SharedSectionHeading
          id="curated-products-title"
          eyebrow={eyebrow}
          title={title}
          description="Start with a deterministic edit from the live catalog, then browse the full range when you want more."
          className="mb-10"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
        <div className="mt-8 flex justify-start">
          <Link href="/shop" className="motion-link inline-flex min-h-12 items-center gap-2 border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase shadow-hard-sm no-underline">
            Browse all products <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

function CategoryDiscovery({ categories }: { categories: StorefrontHomeData["categories"] }) {
  if (!categories.length) return null;

  return (
    <section aria-labelledby="category-title" className="border-b-2 border-border bg-primary-yellow lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <SharedSectionHeading
          id="category-title"
          eyebrow="Discover / 02"
          title="Shop by category"
          description="Go straight to a product family in the live catalog."
          className="mb-6 sm:mb-8 lg:mb-10 [&_h2]:max-w-[12ch] [&_h2]:text-[clamp(1.85rem,7.4vw,2.75rem)] [&_h2]:leading-[0.92] [&_p]:mt-3 [&_p]:max-w-[32ch] [&_p]:text-sm [&_p]:leading-6 sm:[&_p]:text-base"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-6">
          {categories.slice(0, 6).map((category, index) => (
            <Card key={category.id} className="group min-h-0 overflow-hidden p-0 shadow-hard-md sm:shadow-hard-lg">
              <Link
                href={categoryPath(category)}
                aria-label={`Shop ${category.name}`}
                className="motion-link relative flex min-h-[154px] items-end justify-between gap-4 p-5 no-underline sm:min-h-[190px] sm:gap-6 sm:p-7 lg:min-h-[220px] lg:p-8"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute right-0 top-0 h-[88px] w-[88px] translate-x-[18%] -translate-y-[18%] transition-transform duration-300 group-hover:translate-x-[10%] group-hover:translate-y-[-10%] sm:h-28 sm:w-28 lg:h-32 lg:w-32 ${index % 2 === 0 ? "rounded-full bg-primary-red" : "bg-primary-blue"}`}
                />
                <span className="relative z-10 max-w-[75%] text-xl font-900 uppercase leading-[1.05] tracking-[-0.025em] underline decoration-2 underline-offset-4 sm:text-2xl lg:text-3xl">{category.name}</span>
                <span aria-hidden="true" className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center border-2 border-border bg-white transition-transform duration-200 group-hover:translate-x-1 sm:h-11 sm:w-11">
                  <ArrowRight size={22} strokeWidth={2.5} />
                </span>
              </Link>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function NewArrivals({ products }: { products: StorefrontHomeData["newArrivals"] }) {
  if (!products.length) return null;

  return (
    <section aria-labelledby="new-arrivals-title" className="border-b-2 border-border lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <SharedSectionHeading
          id="new-arrivals-title"
          eyebrow="New arrivals / 03"
          title="New arrivals"
          description="The latest published products, ordered by the catalog's canonical creation timestamp."
          className="mb-10"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </Container>
    </section>
  );
}

function CollectionDiscovery({ collections }: { collections: StorefrontHomeData["collections"] }) {
  if (!collections.length) return null;

  return (
    <section aria-labelledby="collection-title" className="border-b-2 border-border bg-primary-blue text-white lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <SharedSectionHeading
          id="collection-title"
          eyebrow="Collections / 04"
          title="Shop the collections"
          description="Enter an active editorial grouping and continue directly into its products."
          className="mb-10 [&_h2]:text-white [&_p]:text-white/90 [&_p:first-of-type]:text-primary-yellow"
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {collections.slice(0, 3).map((collection, index) => (
            <Card key={collection.id} className="min-h-64 border-white bg-white text-foreground shadow-hard-lg">
              <div className="flex h-full flex-col">
                <div className="mb-8 flex items-start justify-between">
                  <span className="text-5xl font-900 leading-none">0{index + 1}</span>
                  <span className="flex h-11 w-11 items-center justify-center border-2 border-border bg-primary-yellow" aria-hidden="true">
                    <Layers3 size={22} strokeWidth={3} />
                  </span>
                </div>
                <h3 className="uppercase">{collection.name}</h3>
                {collection.description ? <p className="mt-3 text-sm leading-6">{collection.description}</p> : null}
                <Link href={collectionPath(collection)} className="motion-link mt-auto inline-flex min-h-11 w-fit items-center gap-2 pt-6 text-sm font-900 uppercase no-underline">
                  Shop this collection <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function BrandValue() {
  return (
    <section aria-labelledby="brand-value-title" className="border-b-2 border-border lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <div className="grid overflow-hidden border-4 border-border bg-white shadow-hard-lg lg:grid-cols-[1.1fr_.9fr]">
          <div className="relative min-h-64 bg-primary-red p-8 text-white sm:p-12">
            <span aria-hidden="true" className="absolute right-8 top-8 h-24 w-24 rounded-full bg-primary-yellow" />
            <span aria-hidden="true" className="absolute bottom-8 left-8 h-20 w-20 rotate-45 bg-primary-blue" />
            <div className="relative z-10">
              <p className="text-xs font-900 uppercase tracking-[.25em] text-white">The 4HRS point of view</p>
              <h2 id="brand-value-title" className="mt-4 max-w-xl uppercase leading-[.9] text-white">Form first.<br />Color clear.</h2>
            </div>
          </div>
          <div className="flex min-h-64 flex-col justify-center p-8 sm:p-12">
            <p className="max-w-xl text-lg leading-8">4HRS builds its fashion language around bold form, clear color and a deliberately graphic point of view.</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="border-t-2 border-border bg-primary-yellow lg:border-t-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <div className="flex flex-col gap-8 border-4 border-border bg-primary-yellow p-7 shadow-hard-lg sm:p-10 lg:flex-row lg:items-end lg:justify-between lg:p-14">
          <div>
            <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Final move / 06</p>
            <h2 id="final-cta-title" className="mt-3 max-w-3xl uppercase leading-[.88]">Find your next piece.</h2>
            <p className="mt-5 max-w-xl text-lg">Browse the live 4HRS catalog.</p>
          </div>
          <Button href="/shop" variant="primary">
            Shop all <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </section>
  );
}

type EditorialHomepageSection = {
  item: { id: string; type: string; locale: string };
  snapshot: ContentSnapshot;
  version: number;
  media: Record<string, { url: string; altText: string | null }>;
  links: Record<string, string>;
};

function EditorialHomepageSections({ sections }: { sections: EditorialHomepageSection[] }) {
  if (!sections.length) return null;
  return <section aria-labelledby="editorial-content-title" className="border-b-2 border-border lg:border-b-4">
    <Container className="py-14 sm:py-18 lg:py-24">
      <SharedSectionHeading id="editorial-content-title" eyebrow="Editorial / 05" title="The 4HRS edit" description="Published editorial content layered over the live catalog." className="mb-10" />
      <div className="grid gap-8">
        {sections.map((section) => (
          <article key={section.item.id} className="border-4 border-border bg-white p-7 shadow-hard-lg sm:p-10">
            <h3 className="text-3xl font-black uppercase">{section.snapshot.title}</h3>
            <EditorialAnalytics contentId={section.item.id} contentType={section.item.type} locale={section.item.locale}>
              <EditorialContent snapshot={section.snapshot} media={section.media} links={section.links} />
            </EditorialAnalytics>
          </article>
        ))}
      </div>
    </Container>
  </section>;
}

function HomepageCampaignBanners() {
  const banners = [
    { src: "/images/homepage-banners/4hrs-hero-banner.jpg", alt: "4HRS+ premium streetwear campaign", className: "col-span-full aspect-[3.72/1]" },
    { src: "/images/homepage-banners/4hrs-men-banner.jpg", alt: "Shop men's streetwear", className: "aspect-[2.9/1]" },
    { src: "/images/homepage-banners/4hrs-women-banner.jpg", alt: "Shop women's streetwear", className: "aspect-[2.9/1]" },
    { src: "/images/homepage-banners/4hrs-new-collection-banner.jpg", alt: "Explore the new 4HRS+ collection", className: "aspect-[2.98/1]" },
    { src: "/images/homepage-banners/4hrs-sale-banner.jpg", alt: "Shop 4HRS+ sale styles", className: "aspect-[2.98/1]" },
  ];

  return (
    <section aria-label="Featured 4HRS+ campaigns" className="border-b-2 border-border bg-background lg:border-b-4">
      <Container width="wide" className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2 sm:gap-4 sm:py-4">
        {banners.map((banner, index) => (
          <Link
            key={banner.src}
            href={index === 1 ? "/category/men" : index === 2 ? "/category/women" : index === 4 ? "/shop" : "/shop"}
            aria-label={banner.alt}
            className={`group relative block overflow-hidden border-2 border-border bg-white shadow-hard-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-hard-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue ${banner.className}`}
          >
            <Image
              src={banner.src}
              alt={banner.alt}
              fill
              priority={index === 0}
              sizes={index === 0 ? "(max-width: 639px) 100vw, 100vw" : "(max-width: 639px) 100vw, 50vw"}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
            />
          </Link>
        ))}
      </Container>
    </section>
  );
}

export function Homepage({ data, editorialSections = [] }: { data: StorefrontHomeData; editorialSections?: EditorialHomepageSection[] }) {
  return (
    <>
      <HomepageCampaignBanners />
      <Hero data={data} />
      <ProductDiscovery eyebrow="Discovery / 01" title="Curated picks" products={data.featuredProducts} />
      <CategoryDiscovery categories={data.categories} />
      <NewArrivals products={data.newArrivals} />
      <CollectionDiscovery collections={data.collections} />
      <BrandValue />
      <EditorialHomepageSections sections={editorialSections} />
      <FinalCta />
    </>
  );
}
