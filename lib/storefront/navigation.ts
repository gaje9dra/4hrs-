import type { NavigationItem } from "@/types/navigation";
import { createCatalogQueryService } from "@/lib/catalog/query";
import { categoryPath, collectionPath } from "@/lib/catalog/routes";

const catalog = createCatalogQueryService();

export async function getStorefrontNavigation(): Promise<NavigationItem[]> {
  const [categories, collections] = await Promise.all([
    catalog.listActiveCategories(),
    catalog.listActiveCollections(),
  ]);

  return [
    { label: "Home", href: "/", match: "exact" },
    { label: "Shop", href: "/shop", match: "section" },
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
