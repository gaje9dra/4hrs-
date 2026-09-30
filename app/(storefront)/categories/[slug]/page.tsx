import { permanentRedirect } from "next/navigation";

type Params = Promise<{ slug: string }>;

export default async function LegacyCategoryRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const normalizedSlug = slug.trim().toLowerCase();
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else if (value !== undefined) {
      search.set(key, value);
    }
  }

  const destination = "/category/" + encodeURIComponent(normalizedSlug);
  permanentRedirect(search.toString() ? destination + "?" + search.toString() : destination);
}
