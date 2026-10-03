import { EditorialAnalytics } from "@/components/storefront/editorial-analytics";
import { EditorialContent } from "@/components/storefront/editorial-content";
import type { ContentSnapshot } from "@/lib/content/service";

export type EditorialPresentation = {
  item: { id: string; type: string; locale: string };
  snapshot: ContentSnapshot;
  version: number;
  media: Record<string, { url: string; altText: string | null }>;
  links: Record<string, string>;
};

export function EditorialSlot({ eyebrow, sections }: { eyebrow: string; sections: EditorialPresentation[] }) {
  if (!sections.length) return null;
  return (
    <section aria-label={eyebrow} className="border-b-4 border-border">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <p className="text-xs font-black uppercase tracking-[.25em] text-primary-red">{eyebrow}</p>
        <div className="mt-6 grid gap-8">
          {sections.map((section) => (
            <article key={section.item.id} className="border-4 border-border bg-white p-7 shadow-hard-lg sm:p-10">
              <h2 className="text-3xl font-black uppercase leading-none">{section.snapshot.title}</h2>
              <EditorialAnalytics contentId={section.item.id} contentType={section.item.type} locale={section.item.locale}>
                <EditorialContent snapshot={section.snapshot} media={section.media} links={section.links} />
              </EditorialAnalytics>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
