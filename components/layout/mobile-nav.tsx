'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { NavigationItem } from '@/types/navigation'
import { HeaderBrand } from '@/components/layout/header-brand'

type MobileNavProps = {
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

export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const trigger = triggerRef.current
    document.body.style.overflow = 'hidden'
    firstLinkRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [open])

  const visibleItems = items.filter((item) => !item.disabled && (item.href || item.children?.length))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="motion-press inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-primary-yellow hover:bg-white lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
      >
        {open ? <X size={22} strokeWidth={2.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={2.5} aria-hidden="true" />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside
            id="mobile-navigation-panel"
            ref={panelRef}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-4 border-border bg-background shadow-hard-md"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation panel"
          >
            <div className="flex min-h-16 items-center justify-between border-b-4 border-border px-4 py-3">
              <HeaderBrand onNavigate={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="motion-press inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-primary-yellow"
                aria-label="Close navigation"
              >
                <X size={22} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            <nav className="overflow-y-auto px-3 py-5 sm:px-4" aria-label="Mobile navigation">
              <ul className="m-0 list-none p-0">
                {visibleItems.map((item, index) => {
                  const active = isActive(item, pathname)
                  const children = item.children?.filter((child) => child.href && !child.disabled) ?? []

                  return (
                    <li key={item.label} className="border-b-2 border-border py-1">
                      {item.href ? (
                        <Link
                          ref={index === 0 ? firstLinkRef : undefined}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'flex min-h-14 items-center justify-between py-3 no-underline',
                            'text-lg font-900 uppercase tracking-[0.06em]',
                            index % 3 === 0 ? 'text-primary-red' : '',
                            index % 3 === 1 ? 'text-primary-blue' : '',
                            'motion-link hover:bg-primary-yellow hover:text-foreground',
                            active ? 'bg-white text-foreground' : '',
                          ].join(' ')}
                        >
                          <span>{item.label}</span>
                          <ChevronRight size={22} strokeWidth={2.5} aria-hidden="true" />
                        </Link>
                      ) : (
                        <div
                          className={[
                            'min-h-12 px-2 py-3 text-xs font-900 uppercase tracking-[0.2em]',
                            active ? 'bg-white' : '',
                          ].join(' ')}
                          aria-current={active ? 'page' : undefined}
                        >
                          {item.label}
                        </div>
                      )}

                      {children.length ? (
                        <ul className="m-0 list-none border-l-4 border-border pl-3">
                          {children.map((child) => {
                            const childActive = child.href === pathname
                            return (
                              <li key={child.label}>
                                <Link
                                  ref={index === 0 && child === children[0] ? firstLinkRef : undefined}
                                  href={child.href!}
                                  onClick={() => setOpen(false)}
                                  aria-current={childActive ? 'page' : undefined}
                                  className={[
                                    'flex min-h-12 items-center px-3 py-2 no-underline',
                                    'text-sm font-700 uppercase tracking-[0.08em]',
                                    'motion-link hover:bg-primary-yellow hover:text-foreground',
                                    childActive ? 'bg-white text-foreground' : '',
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
          </aside>
        </div>
      ) : null}
    </>
  )
}
