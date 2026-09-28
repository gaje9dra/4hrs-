'use client'

import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, X } from 'lucide-react'
import type { NavigationItem } from '@/types/navigation'
import { HeaderBrand } from '@/components/layout/header-brand'

type MobileNavProps = {
  open: boolean
  items: NavigationItem[]
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

export function MobileNav({ open, items, onClose, triggerRef }: MobileNavProps) {
  const panelRef = useRef<HTMLElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstLinkRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
      triggerRef.current?.focus()
    }
  }, [open, onClose, triggerRef])

  if (!open) return null

  const visibleItems = items.filter((item) => item.href && !item.disabled)

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside
        id="mobile-navigation-panel"
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-4 border-border bg-background shadow-hard-md lg:shadow-hard-lg"
        aria-label="Mobile navigation panel"
      >
        <div className="flex min-h-16 items-center justify-between border-b-4 border-border px-4 py-3">
          <HeaderBrand onNavigate={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-primary-yellow transition-transform duration-[120ms] active:translate-x-px active:translate-y-px"
            aria-label="Close navigation"
          >
            <X size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <nav className="overflow-y-auto px-4 py-5" aria-label="Mobile navigation">
          <ul className="m-0 list-none p-0">
            {visibleItems.map((item, index) => (
              <li key={item.label} className="border-b-2 border-border">
                <Link
                  ref={index === 0 ? firstLinkRef : undefined}
                  href={item.href!}
                  onClick={onClose}
                  className={[
                    'flex min-h-14 items-center justify-between py-3 no-underline',
                    'text-lg font-900 uppercase tracking-[0.06em]',
                    index % 3 === 0 ? 'text-primary-red' : '',
                    index % 3 === 1 ? 'text-primary-blue' : '',
                    'hover:bg-primary-yellow hover:text-foreground',
                  ].join(' ')}
                >
                  <span>{item.label}</span>
                  <ChevronRight size={22} strokeWidth={2.5} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  )
}
