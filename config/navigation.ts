import type { UtilityNavigationItem } from "@/types/navigation";

export const utilityNavigation: UtilityNavigationItem[] = [
  { label: "Search", href: "/search", icon: "search" },
];

export const navigationLabels = {
  primary: "Primary navigation",
  utility: "Utility navigation",
  mobile: "Mobile navigation",
} as const;
