'use client'

import { useCallback, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Container } from '@/components/layout/container'
import { HeaderBrand } from '@/components/layout/header-brand'
import { DesktopNav } from '@/components/layout/desktop-nav'
import { MobileNav } from '@/components/layout/mobile-nav'
import { UtilityNav } from '@/components/layout/utility-nav'
import { storefrontNavigation, utilityNavigation } from '@/config/navigation'

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <header className="relative z-50 border-b-2 border-border bg-background lg:border-b-4">
      <Container width="standard" className="flex min-h-16 items-center justify-between gap-3 py-3">
        <HeaderBrand />

        <DesktopNav items={storefrontNavigation} activeHref={pathname} />

        <div className="flex items-center gap-1">
          <UtilityNav items={utilityNavigation} />

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-primary-yellow transition-[background-color,transform] duration-120 hover:bg-white active:translate-x-px active:translate-y-px md:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation-panel"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
          >
            {open ? <X size={22} strokeWidth={2.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </div>
      </Container>

      <MobileNav
        open={open}
        items={storefrontNavigation}
        onClose={closeMenu}
        triggerRef={triggerRef}
      />
    </header>
  )
}
