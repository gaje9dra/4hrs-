import { permanentRedirect } from "next/navigation";
import { collectionPath } from "@/lib/catalog/routes";

type Params = Promise<{ slug: string }>;

export default async function LegacyCollectionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else if (value !== undefined) {
      search.set(key, value);
    }
  }

  const target = collectionPath({ slug }) + (search.toString() ? "?" + search.toString() : "");
  permanentRedirect(target);
}
