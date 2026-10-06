import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { getPublicLandingPage, publicContentSnapshot, resolvePublishedMedia, resolvePublishedReferenceLinks } from "@/lib/content/service";
import { EditorialContent } from "@/components/storefront/editorial-content";
import { absoluteSiteUrl } from "@/config/site";
import { EditorialAnalytics } from "@/components/storefront/editorial-analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  const locale = await resolveRequestLocale();
  const result = await getPublicLandingPage(slug, locale);
  if (!result) notFound();
  const [media, links] = await Promise.all([resolvePublishedMedia(result.snapshot), resolvePublishedReferenceLinks(result.snapshot)]);
  return { result, media, links };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { result } = await load((await params).slug);
  const snapshot = result.snapshot;
  const canonical = snapshot.canonicalUrl ?? absoluteSiteUrl("/content/" + encodeURIComponent(snapshot.slug!));
  const indexable = snapshot.robots !== "noindex,nofollow";
  return {
    title: snapshot.seoTitle ?? snapshot.title,
    description: snapshot.seoDescription ?? snapshot.summary ?? snapshot.title,
    alternates: { canonical },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      title: snapshot.openGraphTitle ?? snapshot.seoTitle ?? snapshot.title,
      description: snapshot.openGraphDescription ?? snapshot.seoDescription ?? snapshot.summary ?? snapshot.title,
      url: canonical,
      type: "article",
    },
  };
}

export default async function EditorialLandingPage({ params }: { params: Params }) {
  const { result, media, links } = await load((await params).slug);
  const snapshot = publicContentSnapshot(result.snapshot);
  return <div className="border-b-4 border-border">
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="text-xs font-black uppercase tracking-[.25em] text-primary-red">Editorial / {result.item.locale}</p>
      <h1 className="mt-3 text-5xl font-black uppercase leading-[.9] tracking-tight">{snapshot.title}</h1>
      <div className="mt-10"><EditorialAnalytics contentId={result.item.id} contentType={result.item.type} locale={result.item.locale}><EditorialContent snapshot={result.snapshot} media={Object.fromEntries(media)} links={Object.fromEntries(links)} /></EditorialAnalytics></div>
    </div>
  </div>;
}