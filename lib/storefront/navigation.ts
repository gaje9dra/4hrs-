import type { FooterNavGroup } from "@/types/footer";
import type { NavigationItem } from "@/types/navigation";
import { getStorefrontNavigationTaxonomy } from "@/lib/storefront/catalog";
import { categoryPath, collectionPath } from "@/lib/catalog/routes";

export async function getStorefrontNavigation(): Promise<NavigationItem[]> {
  const { categories, collections } = await getStorefrontNavigationTaxonomy();

  return [
    { label: "Home", href: "/", match: "exact" },
    {
      label: "Shop",
      href: "/shop",
      match: "section",
      activePrefixes: ["/shop", "/categories/", "/collections/", "/products/"],
    },
    {
      label: "Categories",
      children: categories.map((category) => ({
        label: category.name,
        href: categoryPath(category),
        match: "exact" as const,
      })),
    },
    {
      label: "Collections",
      children: collections.map((collection) => ({
        label: collection.name,
        href: collectionPath(collection),
        match: "exact" as const,
      })),
    },
    { label: "Search", href: "/search", match: "section" },
  ];
}

export function storefrontNavigationToFooterGroups(items: NavigationItem[]): FooterNavGroup[] {
  const shop = items.find((item) => item.label === "Shop" && item.href);
  const categories = items.find((item) => item.label === "Categories");
  const collections = items.find((item) => item.label === "Collections");
  const search = items.find((item) => item.label === "Search" && item.href);

  return [
    {
      label: "Shop",
      items: [
        ...(shop?.href ? [{ label: shop.label, href: shop.href }] : []),
        ...(search?.href ? [{ label: search.label, href: search.href }] : []),
      ],
    },
    {
      label: "Categories",
      items: (categories?.children ?? [])
        .filter((item) => item.href && !item.disabled)
        .map((item) => ({ label: item.label, href: item.href! })),
    },
    {
      label: "Collections",
      items: (collections?.children ?? [])
        .filter((item) => item.href && !item.disabled)
        .map((item) => ({ label: item.label, href: item.href! })),
    },
  ].filter((group) => group.items.length > 0);
}
