import { Container } from '@/components/layout/container'
import { HeaderBrand } from '@/components/layout/header-brand'
import { DesktopNav } from '@/components/layout/desktop-nav'
import { MobileNav } from '@/components/layout/mobile-nav'
import { CustomerAuthStatus } from '@/components/storefront/customer-auth-status'
import type { NavigationItem } from '@/types/navigation'

type HeaderProps = {
  items: NavigationItem[]
}

export function Header({ items }: HeaderProps) {
  return (
    <header className="relative z-50 border-b-2 border-border bg-background lg:border-b-4">
      <Container width="standard" className="flex min-h-16 items-center justify-between gap-3 py-3">
        <HeaderBrand />
        <DesktopNav items={items} />
        <CustomerAuthStatus />
        <MobileNav items={items} />
      </Container>
    </header>
  )
}
