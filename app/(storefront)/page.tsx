import type { Metadata } from "next";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { Homepage } from "@/components/storefront/homepage";
import { getCachedHomepageData } from "@/lib/storefront/homepage-data";

export const metadata: Metadata = { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog through a bold Bauhaus-inspired storefront.", alternates: { canonical: "/" }, robots: { index: true, follow: true }, openGraph: { title: "4HRS — Fashion by Design", description: "Explore the live 4HRS fashion catalog.", url: "/", type: "website" } };

export default async function HomePage() {
  const locale = await resolveRequestLocale();
  const { data, editorialSections } = await getCachedHomepageData(locale);

  return <Homepage data={data} editorialSections={editorialSections} />;
}
