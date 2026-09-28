import Link from 'next/link'
import { Heart, Search, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react'
import type { UtilityNavigationItem } from '@/types/navigation'

const icons: Record<UtilityNavigationItem['icon'], LucideIcon> = {
  search: Search,
  account: UserRound,
  wishlist: Heart,
  cart: ShoppingBag,
}

type UtilityNavProps = {
  items: UtilityNavigationItem[]
}

export function UtilityNav({ items }: UtilityNavProps) {
  const visibleItems = items.filter((item) => item.href)

  if (visibleItems.length === 0) return null

  return (
    <nav className="hidden items-center justify-end gap-1 md:flex" aria-label="Utility navigation">
      {visibleItems.map((item) => {
        const Icon = icons[item.icon]
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.label}
            className="motion-icon inline-flex h-11 w-11 items-center justify-center border-2 border-transparent no-underline hover:border-border hover:bg-primary-yellow"
          >
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        )
      })}
    </nav>
  )
}
