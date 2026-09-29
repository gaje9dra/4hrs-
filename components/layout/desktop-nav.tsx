'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavigationItem } from '@/types/navigation'

type DesktopNavProps = {
  items: NavigationItem[]
}

function isActive(item: NavigationItem, pathname: string) {
  if (item.match === 'section') {
    const exact = item.href === pathname
    const prefix = item.activePrefixes?.some((value) => pathname.startsWith(value)) ?? false
    return exact || prefix || Boolean(item.children?.some((child) => child.href === pathname))
  }

  if (item.match === 'exact' || !item.children?.length) return item.href === pathname
  return item.children.some((child) => child.href === pathname)
}

export function DesktopNav({ items }: DesktopNavProps) {
  const pathname = usePathname()
  const visibleItems = items.filter((item) => !item.disabled && (item.href || item.children?.length))

  if (visibleItems.length === 0) return null

  return (
    <nav className="hidden min-w-0 flex-1 items-center justify-center md:flex" aria-label="Primary navigation">
      <ul className="m-0 flex list-none items-center justify-center gap-1 p-0">
        {visibleItems.map((item) => {
          const active = isActive(item, pathname)
          const children = item.children?.filter((child) => child.href && !child.disabled) ?? []

          return (
            <li key={item.label} className={children.length ? 'group relative' : undefined}>
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={active && !children.length ? 'page' : undefined}
                  className={[
                    'relative inline-flex min-h-11 items-center border-2 border-transparent px-3 py-2',
                    'text-xs font-700 uppercase tracking-[0.12em] no-underline',
                    'motion-link hover:border-border hover:bg-primary-yellow hover:text-foreground',
                    active ? 'border-border bg-white text-foreground after:absolute after:bottom-[-2px] after:left-2 after:right-2 after:h-1 after:bg-primary-red' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  tabIndex={0}
                  className={[
                    'inline-flex min-h-11 items-center border-2 border-transparent px-3 py-2',
                    'text-xs font-700 uppercase tracking-[0.12em] outline-none',
                    'group-focus-within:border-border group-focus-within:bg-white',
                    active ? 'border-border bg-white' : '',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}

              {children.length ? (
                <ul
                  className={[
                    'absolute left-0 top-full z-50 min-w-56 border-2 border-border bg-background p-2 shadow-hard-md',
                    'invisible translate-y-1 opacity-0 transition-[opacity,transform,visibility] duration-(--motion-fast)',
                    'group-hover:visible group-hover:translate-y-0 group-hover:opacity-100',
                    'group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100',
                  ].join(' ')}
                  aria-label={item.label}
                >
                  {children.map((child) => {
                    const childActive = child.href === pathname
                    return (
                      <li key={child.label}>
                        <Link
                          href={child.href!}
                          aria-current={childActive ? 'page' : undefined}
                          className={[
                            'flex min-h-11 items-center border-2 border-transparent px-3 py-2',
                            'text-xs font-700 uppercase tracking-[0.1em] no-underline',
                            'motion-link hover:border-border hover:bg-primary-yellow hover:text-foreground',
                            childActive ? 'border-border bg-white' : '',
                          ].join(' ')}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
