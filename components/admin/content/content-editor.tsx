"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ContentForm = {
  id?: string;
  version?: number;
  type: string;
  internalName: string;
  slug: string;
  locale: string;
  title: string;
  summary: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  robots: string;
  openGraphTitle: string;
  openGraphDescription: string;
  mediaReferences: string;
  linkedReferences: string;
  publicationStartAt: string;
  publicationEndAt: string;
  translationStatus: string;
  sourceContentId: string;
  sourceVersion: string;
};

const TYPES = ["HOMEPAGE_SECTION","LANDING_PAGE","COLLECTION_PAGE","CATEGORY_EDITORIAL","PRODUCT_EDITORIAL","PROMOTIONAL_BANNER","CONTENT_BLOCK"];
const LOCALES = ["en-IN","en-US"];

export function ContentEditor({ initial }: { initial?: ContentForm }) {
  const router = useRouter();
  const [form, setForm] = useState<ContentForm>(initial ?? {
    type: "LANDING_PAGE", internalName: "", slug: "", locale: "en-IN", title: "", summary: "",
    body: '[{"type":"paragraph","text":""}]', seoTitle: "", seoDescription: "", canonicalUrl: "",
    robots: "", openGraphTitle: "", openGraphDescription: "", mediaReferences: "[]", linkedReferences: "[]",
    publicationStartAt: "", publicationEndAt: "", translationStatus: "ORIGINAL", sourceContentId: "", sourceVersion: "",
  });
  const [changeSummary, setChangeSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof ContentForm, value: string) { setForm((current) => ({ ...current, [key]: value })); }

  async function save() {
    setBusy(true); setError("");
    try {
      const body = {
        type: form.type, internalName: form.internalName, slug: form.slug || null, locale: form.locale,
        title: form.title, summary: form.summary || null, body: JSON.parse(form.body),
        seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, canonicalUrl: form.canonicalUrl || null,
        robots: form.robots || null, openGraphTitle: form.openGraphTitle || null, openGraphDescription: form.openGraphDescription || null,
        mediaReferences: JSON.parse(form.mediaReferences), linkedReferences: JSON.parse(form.linkedReferences),
        publicationStartAt: form.publicationStartAt ? new Date(form.publicationStartAt).toISOString() : null,
        publicationEndAt: form.publicationEndAt ? new Date(form.publicationEndAt).toISOString() : null,
        translationStatus: form.translationStatus, sourceContentId: form.sourceContentId || null,
        sourceVersion: form.sourceVersion ? Number(form.sourceVersion) : null,
      };
      const response = await fetch(form.id ? "/api/admin/content/" + form.id : "/api/admin/content", {
        method: form.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form.id ? { expectedVersion: form.version, input: body, changeSummary } : body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error?.message ?? "Content could not be saved.");
      router.push("/admin/content/" + result.content.id);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Content could not be saved.");
    } finally { setBusy(false); }
  }

  return <section className="space-y-5 border-4 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
    <div className="grid gap-4 md:grid-cols-2">
      <label className="font-bold">Content type<select value={form.type} onChange={(e) => set("type", e.target.value)} className="mt-1 w-full border-2 border-black p-2">{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="font-bold">Locale<select value={form.locale} onChange={(e) => set("locale", e.target.value)} className="mt-1 w-full border-2 border-black p-2">{LOCALES.map((locale) => <option key={locale}>{locale}</option>)}</select></label>
      <label className="font-bold">Internal name<input value={form.internalName} onChange={(e) => set("internalName", e.target.value)} className="mt-1 w-full border-2 border-black p-2" maxLength={160}/></label>
      <label className="font-bold">Public slug<input value={form.slug} onChange={(e) => set("slug", e.target.value)} className="mt-1 w-full border-2 border-black p-2" maxLength={200}/></label>
      <label className="font-bold md:col-span-2">Title<input value={form.title} onChange={(e) => set("title", e.target.value)} className="mt-1 w-full border-2 border-black p-2" maxLength={200}/></label>
      <label className="font-bold md:col-span-2">Summary<textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={3} className="mt-1 w-full border-2 border-black p-2" maxLength={500}/></label>
      <label className="font-bold md:col-span-2">Structured content blocks (JSON)<textarea value={form.body} onChange={(e) => set("body", e.target.value)} rows={12} spellCheck={false} className="mt-1 w-full border-2 border-black p-2 font-mono text-sm"/></label>
      <label className="font-bold">SEO title<input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold">SEO description<input value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold">Canonical URL<input value={form.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold">Robots<input value={form.robots} onChange={(e) => set("robots", e.target.value)} placeholder="index,follow" className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold">Open Graph title<input value={form.openGraphTitle} onChange={(e) => set("openGraphTitle", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold">Open Graph description<input value={form.openGraphDescription} onChange={(e) => set("openGraphDescription", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold md:col-span-2">Media reference IDs (JSON array)<textarea value={form.mediaReferences} onChange={(e) => set("mediaReferences", e.target.value)} rows={3} className="mt-1 w-full border-2 border-black p-2 font-mono text-sm"/></label>
      <label className="font-bold md:col-span-2">Catalog references (JSON array)<textarea value={form.linkedReferences} onChange={(e) => set("linkedReferences", e.target.value)} rows={4} className="mt-1 w-full border-2 border-black p-2 font-mono text-sm"/></label>
      <label className="font-bold">Publication start<input type="datetime-local" value={form.publicationStartAt} onChange={(e) => set("publicationStartAt", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
      <label className="font-bold">Publication end<input type="datetime-local" value={form.publicationEndAt} onChange={(e) => set("publicationEndAt", e.target.value)} className="mt-1 w-full border-2 border-black p-2"/></label>
    </div>
    {form.id ? <label className="block font-bold">Change summary<input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} className="mt-1 w-full border-2 border-black p-2" maxLength={1000}/></label> : null}
    {error ? <p role="alert" className="font-bold text-red-700">{error}</p> : null}
    <button type="button" disabled={busy} onClick={save} className="border-2 border-black bg-[#f7d51d] px-5 py-3 font-black uppercase shadow-[4px_4px_0_0_#000]">{busy ? "Saving…" : "Save content"}</button>
  </section>;
}