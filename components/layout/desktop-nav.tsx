import Link from 'next/link'
import type { NavigationItem } from '@/types/navigation'

type DesktopNavProps = {
  items: NavigationItem[]
  activeHref?: string
}

export function DesktopNav({ items, activeHref }: DesktopNavProps) {
  const visibleItems = items.filter((item) => item.href && !item.disabled)

  if (visibleItems.length === 0) return null

  return (
    <nav className="hidden min-w-0 items-center justify-center gap-2 md:flex" aria-label="Primary navigation">
      {visibleItems.map((item) => {
        const active = item.href === activeHref
        return (
          <Link
            key={item.label}
            href={item.href!}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative inline-flex min-h-11 items-center border-2 border-transparent px-3 py-2',
              'text-xs font-700 uppercase tracking-[0.12em] no-underline',
              'motion-link',
              'hover:border-border hover:bg-primary-yellow hover:text-foreground',
              'active:translate-x-px active:translate-y-px',
              active ? 'border-border bg-white text-foreground after:absolute after:bottom-[-2px] after:left-2 after:right-2 after:h-1 after:bg-primary-red' : '',
            ].filter(Boolean).join(' ')}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
