import { requireAdmin } from "@/lib/admin/authorization";
import { ContentEditor } from "@/components/admin/content/content-editor";

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  await requireAdmin(undefined, "content.create");
  return <section className="space-y-6"><header><p className="text-sm font-black uppercase tracking-[.2em]">Editorial governance</p><h2 className="text-4xl font-black uppercase">New content</h2></header><ContentEditor /></section>;
}