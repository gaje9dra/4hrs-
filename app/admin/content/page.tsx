import Link from "next/link";
import { requireAdmin } from "@/lib/admin/authorization";
import { listContent } from "@/lib/content/service";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const context = await requireAdmin(undefined, "content.read");
  const result = await listContent({ limit: 50 });
  return <section className="space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-black uppercase tracking-[.2em]">Editorial governance</p><h2 className="text-4xl font-black uppercase">Content</h2><p className="mt-2 max-w-2xl">Draft, review, approve, schedule, publish, rollback and archive customer-facing editorial content without changing canonical catalog ownership.</p></div>
      {context.permissions.has("content.create") ? <Link href="/admin/content/new" className="border-4 border-black bg-[#f7d51d] px-5 py-3 font-black uppercase shadow-[4px_4px_0_0_#000]">New content</Link> : null}
    </header>
    <div className="overflow-x-auto border-4 border-black bg-white"><table className="min-w-[900px] w-full text-left"><thead><tr className="border-b-4 border-black text-xs uppercase"><th className="p-3">Content</th><th className="p-3">Type</th><th className="p-3">Locale</th><th className="p-3">Status</th><th className="p-3">Version</th><th className="p-3">Updated</th></tr></thead><tbody>{result.items.map((item) => <tr key={item.id} className="border-b-2 border-black last:border-b-0"><td className="p-3"><Link href={"/admin/content/"+item.id} className="font-black underline">{item.title}</Link><div className="text-xs">{item.internalName}</div></td><td className="p-3 font-bold">{item.type}</td><td className="p-3">{item.locale}</td><td className="p-3 font-bold">{item.status}</td><td className="p-3">{item.version}</td><td className="p-3 text-sm">{item.updatedAt.toLocaleString("en-IN")}</td></tr>)}{result.items.length===0 ? <tr><td colSpan={6} className="p-8 text-center font-bold">No editorial content exists yet.</td></tr> : null}</tbody></table></div>
  </section>;
}