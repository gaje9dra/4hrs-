import Link from "next/link";
import type { StorefrontProductDetail } from "@/lib/storefront/catalog";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { categoryPath, collectionPath } from "@/lib/catalog/routes";

function descriptionParagraphs(description: string) {
  return description
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ProductDetailSections({ product }: { product: StorefrontProductDetail }) {
  const paragraphs = product.description ? descriptionParagraphs(product.description) : [];

  if (!paragraphs.length && !product.tags.length && !product.categories.length && !product.collections.length) {
    return null;
  }

  return (
    <section aria-labelledby="product-information" className="mt-12 border-t-4 border-border pt-8 lg:mt-16">
      <div className="mb-6">
        <p className="text-xs font-900 uppercase tracking-[.25em] text-primary-blue">Product information</p>
        <h2 id="product-information" className="mt-2 text-2xl uppercase">Details</h2>
      </div>

      <Accordion className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {paragraphs.length ? (
          <AccordionItem title="Description" defaultOpen>
            <div className="grid gap-4 text-base leading-relaxed">
              {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </AccordionItem>
        ) : null}

        {product.categories.length ? (
          <AccordionItem title="Categories" defaultOpen>
            <div className="flex flex-wrap gap-2">
              {product.categories.map((category) => (
                <Link
                  key={category.id}
                  href={categoryPath(category)}
                  className="border-2 border-border bg-white px-3 py-2 text-sm font-800 uppercase motion-link"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </AccordionItem>
        ) : null}

        {product.collections.length ? (
          <AccordionItem title="Collections" defaultOpen>
            <div className="flex flex-wrap gap-2">
              {product.collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={collectionPath(collection)}
                  className="border-2 border-border bg-primary-yellow px-3 py-2 text-sm font-800 uppercase motion-link"
                >
                  {collection.name}
                </Link>
              ))}
            </div>
          </AccordionItem>
        ) : null}

        {product.tags.length ? (
          <AccordionItem title="Tags">
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag.id} className="border-2 border-border bg-white px-3 py-2 text-sm font-800 uppercase">
                  {tag.name}
                </span>
              ))}
            </div>
          </AccordionItem>
        ) : null}
      </Accordion>
    </section>
  );
}
