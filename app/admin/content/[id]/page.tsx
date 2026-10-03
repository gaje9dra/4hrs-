import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/authorization";
import { getContent } from "@/lib/content/service";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { ContentLifecycleActions } from "@/components/admin/content/content-lifecycle-actions";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireAdmin(undefined, "content.read");
  const content = await getContent((await params).id);
  if (!content) notFound();
  const snapshot = content.revisions.find((revision) => revision.version === content.version)?.snapshot as Record<string, unknown> | undefined;
  const initial = {
    id: content.id, version: content.version, type: content.type, internalName: content.internalName, slug: content.slug ?? "",
    locale: content.locale, title: content.title, summary: content.summary ?? "", body: JSON.stringify(content.body, null, 2),
    seoTitle: content.seoTitle ?? "", seoDescription: content.seoDescription ?? "", canonicalUrl: content.canonicalUrl ?? "",
    robots: content.robots ?? "", openGraphTitle: content.openGraphTitle ?? "", openGraphDescription: content.openGraphDescription ?? "",
    mediaReferences: JSON.stringify(content.mediaReferences), linkedReferences: JSON.stringify(content.linkedReferences),
    publicationStartAt: content.publicationStartAt ? content.publicationStartAt.toISOString().slice(0,16) : "",
    publicationEndAt: content.publicationEndAt ? content.publicationEndAt.toISOString().slice(0,16) : "",
    translationStatus: content.translationStatus, sourceContentId: content.sourceContentId ?? "", sourceVersion: content.sourceVersion ? String(content.sourceVersion) : "",
  };
  void snapshot;
  return <section className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin/content" className="font-bold underline">← Content</Link><p className="mt-5 text-sm font-black uppercase tracking-[.2em]">{content.status} · v{content.version}</p><h2 className="text-4xl font-black uppercase">{content.title}</h2><p className="mt-2">{content.locale}{content.slug ? " · /content/"+content.slug : ""}</p></div></header><ContentLifecycleActions id={content.id} version={content.version} status={content.status} permissions={[...context.permissions]}/><ContentEditor initial={initial}/><section className="border-4 border-black bg-white p-5"><h3 className="text-xl font-black uppercase">Revision history</h3><ol className="mt-4 space-y-2">{content.revisions.map((revision) => <li key={revision.id} className="border-2 border-black p-3"><span className="font-bold">v{revision.version}</span> · {revision.createdAt.toLocaleString("en-IN")}{revision.changeSummary ? " · "+revision.changeSummary : ""}</li>)}</ol></section></section>;
}