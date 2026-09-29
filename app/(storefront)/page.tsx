import type { Metadata } from "next";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { getStorefrontHomeCatalogData } from "@/lib/storefront/catalog";
import { Homepage } from "@/components/storefront/homepage";

export const metadata: Metadata = {
  title: "4HRS — Fashion by Design",
  description: "Explore the live 4HRS fashion catalog through a bold Bauhaus-inspired storefront.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "4HRS — Fashion by Design",
    description: "Explore the live 4HRS fashion catalog.",
    type: "website",
  },
};

export default async function HomePage() {
  let data;
  try {
    data = await getStorefrontHomeCatalogData();
  } catch (error) {
    if (error instanceof CatalogServiceError) throw error;
    throw new Error("Homepage catalog data could not be loaded.", { cause: error });
  }

  return <Homepage data={data} />;
}
