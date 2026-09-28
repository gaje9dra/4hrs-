import type { NavigationItem, UtilityNavigationItem } from '@/types/navigation'

/**
 * Single source of truth for global storefront navigation.
 *
 * Only routes that exist in the current foundation are rendered as active
 * navigation links. Future storefront destinations can be added here when
 * their routes are implemented.
 */
export const storefrontNavigation: NavigationItem[] = [
  { label: 'Home', href: '/' },
]

export const utilityNavigation: UtilityNavigationItem[] = []

export const navigationLabels = {
  primary: 'Primary navigation',
  utility: 'Utility navigation',
  mobile: 'Mobile navigation',
} as const
