import Image from "next/image";
import Link from "next/link";
import type { ContentBlock, ContentSnapshot } from "@/lib/content/service";

type MediaMap = Record<string, { url: string; altText: string | null }>;

function Block({ block, media, links }: { block: ContentBlock; media: MediaMap; links: Record<string, string> }) {
  if (block.type === "heading") {
    return block.level === 2 ? <h2 className="mt-10 text-3xl font-black uppercase">{block.text}</h2> : <h3 className="mt-8 text-2xl font-black uppercase">{block.text}</h3>;
  }
  if (block.type === "paragraph") return <p className="mt-5 max-w-3xl text-lg leading-8">{block.text}</p>;
  if (block.type === "image") {
    const asset = media[block.mediaId];
    if (!asset) return null;
    return <figure className="my-10 overflow-hidden border-4 border-border bg-white shadow-hard-md"><Image src={asset.url} alt={block.decorative ? "" : block.altText || asset.altText || ""} width={1400} height={900} className="h-auto w-full object-cover" /><figcaption className="sr-only">{block.decorative ? "" : block.altText}</figcaption></figure>;
  }
  if (block.type === "link" || block.type === "cta") return <Link href={block.href} data-content-cta-block={block.type} className="motion-link mt-6 inline-flex min-h-11 items-center border-2 border-border bg-white px-5 py-3 text-sm font-black uppercase shadow-hard-sm">{block.label}</Link>;
  if (block.type === "product") return <Link href={links[block.productId] ?? "/shop"} data-content-cta-block="product" className="motion-link mt-6 inline-flex min-h-11 items-center border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-black uppercase shadow-hard-sm">View product</Link>;
  if (block.type === "category") return <Link href={links[block.categoryId] ?? "/shop"} data-content-cta-block="category" className="motion-link mt-6 inline-flex min-h-11 items-center border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-black uppercase shadow-hard-sm">View category</Link>;
  return <Link href={links[block.collectionId] ?? "/shop"} data-content-cta-block="collection" className="motion-link mt-6 inline-flex min-h-11 items-center border-2 border-border bg-primary-yellow px-5 py-3 text-sm font-black uppercase shadow-hard-sm">View collection</Link>;
}

export function EditorialContent({ snapshot, media, links }: { snapshot: ContentSnapshot; media: MediaMap; links: Record<string, string> }) {
  return <article>
    {snapshot.summary ? <p className="max-w-3xl text-xl font-medium leading-8">{snapshot.summary}</p> : null}
    <div>{snapshot.body.map((block, index) => <Block key={index} block={block} media={media} links={links} />)}</div>
  </article>;
}