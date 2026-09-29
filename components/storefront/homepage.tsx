import Link from "next/link";
import { ArrowRight, Compass, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/components/storefront/product-card";
import { Container } from "@/components/layout/container";
import { GeometricComposition, GeometricLayer } from "@/components/bauhaus/geometric-composition";
import { categoryPath, collectionPath } from "@/lib/catalog/routes";
import type { StorefrontHomeData } from "@/lib/storefront/catalog";

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string | null }) {
  return (
    <header className="mb-10 grid gap-4 lg:grid-cols-[1fr_1.4fr] lg:items-end">
      <div>
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">{eyebrow}</p>
        <h2 className="mt-3 uppercase leading-[.92]">{title}</h2>
      </div>
      {body ? <p className="max-w-2xl text-base leading-7 lg:text-lg">{body}</p> : null}
    </header>
  );
}

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
              Shop now <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <GeometricComposition
          className="min-h-[390px] border-2 border-t-0 border-border bg-background shadow-hard-lg lg:min-h-full lg:border-4 lg:border-l-0 lg:border-t-4"
          label={visualProduct?.title ? "Featured fashion product composition" : "Decorative geometric fashion composition"}
        >
          <GeometricLayer layer="back" className="right-[-4rem] top-[-4rem] h-48 w-48 rounded-full bg-primary-red sm:h-64 sm:w-64" />
          <GeometricLayer layer="back" className="bottom-[-3rem] left-[-3rem] h-44 w-44 bg-primary-yellow sm:h-60 sm:w-60" />
          {visualProduct?.image ? (
            <div className="absolute inset-10 z-10 overflow-hidden border-4 border-border bg-white shadow-hard-md sm:inset-14 lg:inset-16">
              <img
                src={visualProduct.image.url}
                alt={visualProduct.image.altText ?? visualProduct.title}
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
            </div>
          ) : (
            <GeometricLayer layer="base" className="left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rotate-12 bg-primary-blue clip-triangle sm:h-56 sm:w-56" />
          )}
          <GeometricLayer layer="front" className="bottom-6 right-6 h-16 w-28 border-4 border-border bg-white shadow-hard-sm sm:h-24 sm:w-40" />
        </GeometricComposition>
      </Container>
    </section>
  );
}

function ProductDiscovery({ title, eyebrow, products }: { title: string; eyebrow: string; products: StorefrontHomeData["newArrivals"] }) {
  if (!products.length) return null;

  return (
    <section aria-labelledby={eyebrow + "-title"} className="border-b-2 border-border lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
        <div className="mt-8 flex justify-start">
          <Link href="/shop" className="motion-link inline-flex min-h-12 items-center gap-2 border-2 border-border bg-white px-5 py-3 text-sm font-900 uppercase shadow-hard-sm no-underline">
            Explore all products <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

function CategoryDiscovery({ categories }: { categories: StorefrontHomeData["categories"] }) {
  if (!categories.length) return null;

  return (
    <section aria-labelledby="category-title" className="bg-primary-yellow border-b-2 border-border lg:border-b-4">
      <Container className="py-14 sm:py-18 lg:py-24">
        <SectionHeading eyebrow="Discover / 02" title="Shop by category" body="Start with the product family that fits your wardrobe and explore the live catalog." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.slice(0, 6).map((category, index) => (
            <Link
              key={category.id}
              href={categoryPath(category)}
              className="motion-lift group relative min-h-36 overflow-hidden border-4 border-border bg-white p-6 shadow-hard-md no-underline"
            >
              <span aria-hidden="true" className={`absolute -right-6 -top-8 h-24 w-24 rounded-full ${index % 3 === 0 ? "bg-primary-red" : index % 3 === 1 ? "bg-primary-blue" : "bg-primary-yellow"} transition-transform duration-200 group-hover:rotate-12`} />
              <span className="relative z-10 flex h-full items-end justify-between gap-4">
                <span className="text-2xl font-900 uppercase leading-none">{category.name}</span>
                <ArrowRight size={24} strokeWidth={3} aria-hidden="true" />
              </span>
            </Link>
          ))}
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
        <SectionHeading eyebrow="Curated / 03" title="Collections" body="Browse the active editorial groups already defined in the canonical catalog." />
        <div className="grid gap-6 lg:grid-cols-3">
          {collections.slice(0, 3).map((collection, index) => (
            <Card key={collection.id} className="min-h-64 border-white bg-white text-foreground shadow-hard-lg">
              <div className="flex h-full flex-col">
                <div className="mb-10 flex items-start justify-between">
                  <span className="text-5xl font-900 leading-none">0{index + 1}</span>
                  <span className="flex h-11 w-11 items-center justify-center border-2 border-border bg-primary-yellow" aria-hidden="true">
                    <Layers3 size={22} strokeWidth={3} />
                  </span>
                </div>
                <h3 className="uppercase">{collection.name}</h3>
                {collection.description ? <p className="mt-3 text-sm leading-6">{collection.description}</p> : null}
                <Link href={collectionPath(collection)} className="motion-link mt-auto inline-flex min-h-11 w-fit items-center gap-2 pt-6 text-sm font-900 uppercase no-underline">
                  Explore <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function EditorialBlock({ collection }: { collection: StorefrontHomeData["editorialCollection"] }) {
  if (!collection) return null;

  return (
    <section aria-labelledby="editorial-title">
      <Container className="py-14 sm:py-18 lg:py-24">
        <div className="grid overflow-hidden border-4 border-border bg-white shadow-hard-lg lg:grid-cols-[1.1fr_.9fr]">
          <div className="relative min-h-72 bg-primary-blue p-8 text-white sm:p-12">
            <span aria-hidden="true" className="absolute right-8 top-8 h-24 w-24 rounded-full bg-primary-red" />
            <span aria-hidden="true" className="absolute bottom-8 left-8 h-20 w-20 rotate-45 bg-primary-yellow" />
            <div className="relative z-10">
              <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-yellow">Editorial / 04</p>
              <h2 id="editorial-title" className="mt-4 uppercase leading-[.9] text-white">{collection.name}</h2>
            </div>
          </div>
          <div className="flex min-h-72 flex-col justify-center p-8 sm:p-12">
            {collection.description ? <p className="max-w-xl text-lg leading-8">{collection.description}</p> : <p className="max-w-xl text-lg leading-8">A live collection from the 4HRS catalog, presented through the same visual system as the storefront.</p>}
            <Link href={collectionPath(collection)} className="motion-link mt-7 inline-flex min-h-12 w-fit items-center gap-2 border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-900 uppercase shadow-hard-sm no-underline">
              Explore collection <Compass size={18} aria-hidden="true" />
            </Link>
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
            <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-red">Final move / 05</p>
            <h2 id="final-cta-title" className="mt-3 max-w-3xl uppercase leading-[.88]">Ready to explore?</h2>
            <p className="mt-5 max-w-xl text-lg">Discover the live 4HRS catalog.</p>
          </div>
          <Button href="/shop" variant="primary">
            Shop all <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </section>
  );
}

export function Homepage({ data }: { data: StorefrontHomeData }) {
  return (
    <div className="overflow-hidden">
      <Hero data={data} />
      <ProductDiscovery eyebrow="Discovery / 01" title="Featured" products={data.featuredProducts} />
      <CategoryDiscovery categories={data.categories} />
      <ProductDiscovery eyebrow="New arrivals / 03" title="New arrivals" products={data.newArrivals} />
      <CollectionDiscovery collections={data.collections} />
      <EditorialBlock collection={data.editorialCollection} />
      <FinalCta />
    </div>
  );
}
