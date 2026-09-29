export type NavigationItem = {
  label: string
  href?: string
  children?: NavigationItem[]
  external?: boolean
  disabled?: boolean
  match?: "exact" | "section"
  activePrefixes?: string[]
}

export type UtilityNavigationItem = {
  label: string
  href: string
  icon: "search" | "account" | "wishlist" | "cart"
}
